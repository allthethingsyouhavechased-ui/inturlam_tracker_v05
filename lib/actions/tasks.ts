"use server";

import { TaskTransitionError } from "@/lib/taskLifecycle";
import {
  ExpectedActionError,
  runAction,
  runAfterCommit,
  type ActionResult,
} from "@/lib/actionResult";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordActivity } from "@/lib/activity";
import { activeAssigneeId } from "@/lib/assignees";
import {
  CONTENT_TYPES,
  REPEAT_OPTIONS,
  TASK_DIFFICULTIES,
  TASK_DIFFICULTY_LABEL,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUSES,
} from "@/lib/constants";
import { formatDateShort, todayISO } from "@/lib/date";
import { announceGuestTaskPlanned, announceGuestTaskStatus } from "@/lib/guestTaskCommunications";
import { assertWeightPoints, resolveTaskCreationWeight } from "@/lib/progress";
import { requireManager, requireSession } from "@/lib/identity";
import { notifyTaskUpdate } from "@/lib/notifications";
import { setPersonalTaskTarget } from "@/lib/repositories/personalTargets";
import { getPerson } from "@/lib/repositories/people";
import { deleteTaskAttachment, getTaskAttachment } from "@/lib/repositories/taskAttachments";
import {
  bulkDeleteTasks,
  bulkUpdateTaskAssignee,
  bulkUpdateTaskPriority,
  bulkUpdateTaskStatus,
  completeTaskRevision,
  createTask,
  deleteTask,
  getTask,
  setTaskArchived,
  startTaskRevision,
  updateTaskAssignee,
  updateTaskDetails,
  updateTaskDueDate,
  updateTaskDifficulty,
  updateTaskPriority,
  updateTaskRepeat,
  updateTaskStatus,
  updateTaskWeight,
} from "@/lib/repositories/tasks";
import type { ContentType, TaskDifficulty, TaskPriority, TaskStatus } from "@/lib/types";
import { listUploadPathsForTaskIds } from "@/lib/repositories/uploadReferences";
import {
  deleteUploadedFile,
  deleteUploadedFiles,
  extractImageFiles,
  validateImageFiles,
  withSavedImageFiles,
} from "@/lib/uploads";

function cleanText(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length > 0 ? s : null;
}

function cleanDate(value: FormDataEntryValue | string | null): string | null {
  const date = cleanText(value);
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Geçersiz tarih.");
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("Geçersiz tarih.");
  }
  return date;
}

function requiredDate(value: FormDataEntryValue | string | null): string {
  const date = cleanDate(value);
  if (!date) throw new Error("Teslim tarihi zorunlu.");
  return date;
}

export async function createTaskAction(formData: FormData): Promise<string> {
  const actor = await requireSession();
  const contentItemId = String(formData.get("contentItemId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const priorityRaw = String(formData.get("priority") ?? "Normal") as TaskPriority;
  const priority = TASK_PRIORITIES.includes(priorityRaw) ? priorityRaw : "Normal";
  const difficulty = String(formData.get("difficulty") ?? "") as TaskDifficulty;
  const contentType = String(formData.get("contentType") ?? "") as ContentType;
  if (!TASK_DIFFICULTIES.includes(difficulty)) throw new Error("Zorluk derecesi seçilmeli.");
  const weightPoints = resolveTaskCreationWeight(
    formData.get("weightPoints"),
    actor.is_manager === 1,
    difficulty,
  );

  if (!contentItemId) throw new Error("İçerik bulunamadı.");
  if (!title) throw new Error("Görev başlığı zorunlu.");
  if (title.length > 200) throw new Error("Görev başlığı en fazla 200 karakter olabilir.");
  if (!CONTENT_TYPES.includes(contentType)) throw new Error("Görev türü seçilmeli.");

  const id = createTask({
    contentItemId,
    title,
    assigneeId: activeAssigneeId(cleanText(formData.get("assigneeId"))),
    dueDate: requiredDate(formData.get("dueDate")),
    contentType,
    weightPoints,
    difficulty,
    priority,
  });

  const created = getTask(id);
  await recordActivity({
    action: "task.create",
    entityType: "task",
    entityId: id,
    brandId: created?.brand_id ?? null,
    summary: `“${title}” görevini oluşturdu`,
  });

  revalidatePath("/", "layout");
  return id;
}

export async function setTaskStatusAction(taskId: string, status: TaskStatus) {
  const actor = await requireSession();
  if (!TASK_STATUSES.includes(status)) throw new Error("Geçersiz durum.");
  const task = getTask(taskId);
  if (!task) throw new Error("Görev bulunamadı.");
  let changed: boolean;
  try { changed = updateTaskStatus(taskId, status, actor.id); }
  catch (error) { return { ok: false as const, error: error instanceof TaskTransitionError ? error.message : "Görev durumu güncellenemedi. Yeniden deneyin." }; }
  if (changed) {
    if (task.origin === "guest") {
      await announceGuestTaskStatus({
        actor,
        taskId,
        taskTitle: task.title,
        brandId: task.brand_id,
        statusLabel: TASK_STATUS_LABEL[status],
      });
    } else {
      await recordActivity({
        action: "task.status",
        entityType: "task",
        entityId: taskId,
        brandId: task.brand_id,
        summary: `“${task.title}” görevini ${TASK_STATUS_LABEL[status]} durumuna aldı`,
      });
    }
  }

  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function setTaskRepeatAction(taskId: string, repeatDays: number) {
  await requireSession();
  if (!REPEAT_OPTIONS.some((o) => o.days === repeatDays)) {
    throw new Error("Geçersiz tekrar aralığı.");
  }
  const task = getTask(taskId);
  if (!task) throw new Error("Görev bulunamadı.");
  if (repeatDays > 0 && !task.due_date) throw new Error("Tekrar eklemeden önce teslim tarihi atanmalı.");

  const nextRepeatDays = repeatDays > 0 ? repeatDays : null;
  if (task.repeat_days === nextRepeatDays) return;

  updateTaskRepeat(taskId, nextRepeatDays);
  const label = REPEAT_OPTIONS.find((o) => o.days === repeatDays)!.label;
  await recordActivity({
    action: "task.repeat.set",
    entityType: "task",
    entityId: taskId,
    brandId: task.brand_id,
    summary: `“${task.title}” görevinin tekrarını “${label}” yaptı`,
  });
  revalidatePath("/", "layout");
}

export async function setTaskPriorityAction(
  taskId: string,
  priority: TaskPriority,
) {
  await requireSession();
  if (!TASK_PRIORITIES.includes(priority)) throw new Error("Geçersiz öncelik.");
  const task = getTask(taskId);
  if (!task) throw new Error("Görev bulunamadı.");
  if (!updateTaskPriority(taskId, priority)) return;
  await recordActivity({
    action: "task.priority",
    entityType: "task",
    entityId: taskId,
    brandId: task.brand_id,
    summary: `“${task.title}” önceliğini ${TASK_PRIORITY_LABEL[priority]} yaptı`,
  });
  revalidatePath("/", "layout");
}

export async function setTaskAssigneeAction(
  taskId: string,
  assigneeId: string | null,
) {
  await requireSession();
  const task = getTask(taskId);
  if (!task) throw new Error("Görev bulunamadı.");
  const target = activeAssigneeId(assigneeId);
  if (!updateTaskAssignee(taskId, target)) return;
  const name = target ? (getPerson(target)?.name ?? null) : null;
  await recordActivity({
    action: "task.assignee",
    entityType: "task",
    entityId: taskId,
    brandId: task.brand_id,
    summary: name
      ? `“${task.title}” görevini ${name} kişisine atadı`
      : `“${task.title}” görevinin atamasını kaldırdı`,
  });
  revalidatePath("/", "layout");
}

export async function setTaskDueDateAction(taskId: string, dueDate: string | null) {
  const actor = await requireSession();
  const task = getTask(taskId);
  if (!task) throw new Error("Görev bulunamadı.");
  const cleanDueDate = requiredDate(dueDate);
  if (task.due_date === cleanDueDate) return;
  updateTaskDueDate(taskId, cleanDueDate);
  if (task.origin === "guest" && !task.due_date) {
    await announceGuestTaskPlanned({ actor, taskId, taskTitle: task.title, brandId: task.brand_id });
  } else {
    await recordActivity({
      action: "task.duedate",
      entityType: "task",
      entityId: taskId,
      brandId: task.brand_id,
      summary: `“${task.title}” teslim tarihini ${formatDateShort(cleanDueDate)} yaptı`,
    });
  }
  revalidatePath("/", "layout");
}

export async function setPersonalTaskTargetAction(
  taskId: string,
  targetDate: string | null,
) {
  const person = await requireSession();

  const cleanTarget = targetDate?.trim() || null;
  setPersonalTaskTarget(taskId, person.id, cleanTarget, todayISO());
  // Hedef artık yalnızca Panom'da değil, Görevler panosunda/listesinde ve
  // takvimde de gösteriliyor — tek bir sayfayı tazelemek yetmiyor.
  revalidatePath("/", "layout");
}

// Doğrulama hataları FIRLATILMIYOR, dönüş değeriyle taşınıyor: üretimde
// fırlatılan hata React #441'e indirgeniyor ve Türkçe mesaj kullanıcıya hiç
// ulaşmıyordu (bkz. lib/actionResult.ts). Kaydetme, etkinlik/bildirim
// aşamalarından da AYRI: bildirim patlarsa kayıt yine de duruyor.
export async function updateTaskDetailsAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireSession();
  return runAction("task.updateDetails", async () => {
    const id = String(formData.get("taskId") ?? "").trim();
    const title = String(formData.get("title") ?? "").trim();
    if (!id) throw new ExpectedActionError("Görev bulunamadı.", "notFound");
    if (!title) throw new ExpectedActionError("Görev başlığı zorunlu.");
    if (title.length > 200) throw new ExpectedActionError("Görev başlığı en fazla 200 karakter olabilir.");
    const notes = cleanText(formData.get("notes"));
    if ((notes?.length ?? 0) > 5000) throw new ExpectedActionError("Görev notu en fazla 5000 karakter olabilir.");
    const notifyMessage = cleanText(formData.get("notifyMessage"));
    if ((notifyMessage?.length ?? 0) > 1000) throw new ExpectedActionError("Bildirim notu en fazla 1000 karakter olabilir.");
    const task = getTask(id);
    if (!task) throw new ExpectedActionError("Görev bulunamadı.", "notFound");
    const contentType = String(formData.get("contentType") ?? "") as ContentType;
    if (!CONTENT_TYPES.includes(contentType)) throw new ExpectedActionError("Geçerli bir görev türü seçin.");

    const images = extractImageFiles(formData);
    try { validateImageFiles(images); }
    catch (error) { throw new ExpectedActionError(error instanceof Error ? error.message : "Görseller kabul edilmedi."); }

    let dueDate: string;
    try { dueDate = requiredDate(formData.get("dueDate")); }
    catch (error) { throw new ExpectedActionError(error instanceof Error ? error.message : "Teslim tarihi geçersiz."); }

    // Eşzamanlı düzenleme: form açıldığı andaki damga taşınır. Damga değiştiyse
    // araya başka birinin kaydı girmiştir; sessizce ezmek yerine kullanıcıya
    // güncel değerleri gösterip kararı ona bırakıyoruz.
    const expectedUpdatedAt = cleanText(formData.get("expectedUpdatedAt"));
    if (expectedUpdatedAt && task.updated_at !== expectedUpdatedAt) {
      return {
        ok: false as const,
        code: "conflict" as const,
        error: "Bu görevi sen formu açtıktan sonra başka biri güncelledi. Aşağıdaki güncel hâli gör, sonra kendi değişikliğini tekrar uygula.",
        current: {
          title: task.title,
          contentType: task.content_type,
          dueDate: task.due_date,
          notes: task.notes,
          updatedAt: task.updated_at,
        },
      };
    }

    await withSavedImageFiles(images, "tasks", (saved) =>
      updateTaskDetails({ id, title, contentType, dueDate, notes }, saved),
    );

    // Buradan sonrası yan etki: patlarsa kayıt geri alınmaz, yalnızca loglanır.
    await runAfterCommit("task.updateDetails", async () => {
      if (task.origin === "guest" && !task.due_date) {
        await announceGuestTaskPlanned({ actor, taskId: id, taskTitle: title, brandId: task.brand_id });
      } else {
        await recordActivity({
          action: "task.details",
          entityType: "task",
          entityId: id,
          brandId: task.brand_id,
          summary: `“${title}” görev detaylarını güncelledi`,
        });
      }
      notifyTaskUpdate({
        actor,
        taskId: id,
        taskTitle: title,
        brandId: task.brand_id,
        assigneeId: task.assignee_id,
        message: notifyMessage,
      });
    });

    revalidatePath("/", "layout");
    return { ok: true as const, message: "Görev ayrıntıları kaydedildi." };
  });
}

export async function setTaskDifficultyAction(
  taskId: string,
  difficulty: TaskDifficulty,
) {
  await requireSession();
  if (!TASK_DIFFICULTIES.includes(difficulty)) throw new Error("Geçersiz zorluk derecesi.");
  const task = getTask(taskId);
  if (!task) throw new Error("Görev bulunamadı.");
  if (!updateTaskDifficulty(taskId, difficulty)) return;
  await recordActivity({
    action: "task.difficulty",
    entityType: "task",
    entityId: taskId,
    brandId: task.brand_id,
    summary: `“${task.title}” zorluk derecesini ${TASK_DIFFICULTY_LABEL[difficulty]} yaptı`,
  });
  revalidatePath("/", "layout");
}

export async function startTaskRevisionAction(formData: FormData) {
  const actor = await requireSession();
  const taskId = String(formData.get("taskId") ?? "").trim();
  const targetMinutes = Number(formData.get("targetMinutes"));
  const note = cleanText(formData.get("note"));
  if (!taskId) throw new Error("Görev bulunamadı.");
  if ((note?.length ?? 0) > 1000) throw new Error("Revize notu en fazla 1000 karakter olabilir.");
  const task = getTask(taskId);
  if (!task) throw new Error("Görev bulunamadı.");
  const round = startTaskRevision({ taskId, targetMinutes, note, actorId: actor.id });
  await recordActivity({
    action: "task.revision.start",
    entityType: "task",
    entityId: taskId,
    brandId: task.brand_id,
    summary: `“${task.title}” görevinin ${round.round_number}. revize turunu başlattı`,
  });
  revalidatePath("/", "layout");
}

export async function completeTaskRevisionAction(revisionId: string) {
  const actor = await requireSession();
  const round = completeTaskRevision(revisionId, actor.id);
  const task = getTask(round.task_id);
  if (!task) throw new Error("Görev bulunamadı.");
  await recordActivity({
    action: "task.revision.complete",
    entityType: "task",
    entityId: task.id,
    brandId: task.brand_id,
    summary: `“${task.title}” görevinin ${round.round_number}. revize turunu tamamladı`,
  });
  revalidatePath("/", "layout");
}

export async function setTaskWeightAction(taskId: string, weightPoints: number) {
  const actor = await requireSession();
  if (actor.is_manager !== 1) throw new Error("Görev ağırlığını yalnızca yöneticiler değiştirebilir.");
  const task = getTask(taskId);
  if (!task) throw new Error("Görev bulunamadı.");
  const nextWeight = assertWeightPoints(weightPoints);
  if (task.weight_points === nextWeight) return;
  updateTaskWeight(taskId, nextWeight);
  await recordActivity({
    action: "task.weight",
    entityType: "task",
    entityId: taskId,
    brandId: task.brand_id,
    summary: `“${task.title}” görev ağırlığını ${weightPoints} puan yaptı`,
  });
  revalidatePath("/", "layout");
}

// Elle arşivleme / arşivden çıkarma. Görevin DURUMU değişmez — arşiv yalnızca
// "panoda görünsün mü" sorusunu cevaplar. Yayınlanan işler zaten
// ARCHIVE_AFTER_DAYS gün sonra kendiliğinden arşivlenir; bu action iki uç durum
// için: işi erken temizlemek ve yanlışlıkla arşivleneni geri getirmek.
export async function setTaskArchivedAction(taskId: string, archived: boolean) {
  await requireSession();
  const task = getTask(taskId);
  if (!task) throw new Error("Görev bulunamadı.");
  if ((task.archived_at !== null) === archived) return;

  setTaskArchived(taskId, archived);
  await recordActivity({
    action: archived ? "task.archive" : "task.unarchive",
    entityType: "task",
    entityId: taskId,
    brandId: task.brand_id,
    summary: archived
      ? `“${task.title}” görevini arşivledi`
      : `“${task.title}” görevini arşivden çıkardı`,
  });
  revalidatePath("/", "layout");
}

// Arşivdeki tamamlanmış işi yalnızca görünür yapmak, bir sonraki görev listesi
// ziyaretinde otomatik arşiv süpürgesinin onu yeniden saklamasına yol açar.
// Bu nedenle gerçek bir "yeniden aç" işlemi yayınlanmış görevi aktif akışa alır;
// elle arşivlenmiş açık bir görevdeyse yalnızca arşiv damgasını kaldırır.
export async function restoreArchivedTaskAction(taskId: string) {
  const actor = await requireSession();
  const task = getTask(taskId);
  if (!task) throw new Error("Görev bulunamadı.");
  if (task.archived_at === null) return;

  if (task.status === "Yayinlandi") {
    updateTaskStatus(taskId, "DevamEdiyor", actor.id);
  } else {
    setTaskArchived(taskId, false);
  }
  await recordActivity({
    action: "task.restore",
    entityType: "task",
    entityId: taskId,
    brandId: task.brand_id,
    summary: `“${task.title}” görevini yeniden açtı`,
  });
  revalidatePath("/", "layout");
}

export async function deleteTaskAttachmentAction(attachmentId: string) {
  await requireSession();
  const attachment = getTaskAttachment(attachmentId);
  if (!attachment) return;
  deleteTaskAttachment(attachmentId);
  await deleteUploadedFile(attachment.file_path);
  revalidatePath("/", "layout");
}

export async function deleteTaskAction(taskId: string) {
  await requireManager();
  const task = getTask(taskId);
  if (!task) throw new Error("Görev bulunamadı.");
  const uploadPaths = listUploadPathsForTaskIds([taskId]);
  deleteTask(taskId);
  await deleteUploadedFiles(uploadPaths);
  await recordActivity({
    action: "task.delete",
    entityType: "task",
    entityId: null,
    brandId: task.brand_id,
    summary: `“${task.title}” görevini sildi`,
  });
  revalidatePath("/", "layout");
  redirect(`/brands/${task.brand_id}/content/${task.content_item_id}`);
}

// ---- Toplu görev işlemleri (Görevler > Liste görünümü) ----

function cleanIds(ids: string[]): string[] {
  const clean = Array.from(
    new Set(ids.map((id) => String(id ?? "").trim()).filter(Boolean)),
  );
  if (clean.length > 200) throw new Error("Tek seferde en fazla 200 görev değiştirilebilir.");
  return clean;
}

export async function bulkSetTaskStatusAction(ids: string[], status: TaskStatus) {
  const actor = await requireSession();
  if (!TASK_STATUSES.includes(status)) throw new Error("Geçersiz durum.");
  const clean = cleanIds(ids);
  const guestTasksToNotify = clean.flatMap((id) => {
    const task = getTask(id);
    return task?.origin === "guest" && task.status !== status ? [task] : [];
  });
  let changedCount: number;
  try { changedCount = bulkUpdateTaskStatus(clean, status, actor.id); }
  catch (error) { return { ok: false as const, error: error instanceof TaskTransitionError ? error.message : "Görev durumları güncellenemedi. Yeniden deneyin." }; }
  if (changedCount > 0) {
    await recordActivity({
      action: "task.bulk.status",
      entityType: "task",
      entityId: null,
      brandId: null,
      summary: `${changedCount} görevi ${TASK_STATUS_LABEL[status]} durumuna aldı`,
    });
    for (const task of guestTasksToNotify) {
      await announceGuestTaskStatus({
        actor,
        taskId: task.id,
        taskTitle: task.title,
        brandId: task.brand_id,
        statusLabel: TASK_STATUS_LABEL[status],
      });
    }
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function bulkSetTaskPriorityAction(
  ids: string[],
  priority: TaskPriority,
) {
  await requireSession();
  if (!TASK_PRIORITIES.includes(priority)) throw new Error("Geçersiz öncelik.");
  const clean = cleanIds(ids);
  const changedCount = bulkUpdateTaskPriority(clean, priority);
  if (changedCount > 0) {
    await recordActivity({
      action: "task.bulk.priority",
      entityType: "task",
      entityId: null,
      brandId: null,
      summary: `${changedCount} görevin önceliğini ${TASK_PRIORITY_LABEL[priority]} yaptı`,
    });
  }
  revalidatePath("/", "layout");
}

export async function bulkSetTaskAssigneeAction(
  ids: string[],
  assigneeId: string | null,
) {
  await requireSession();
  const clean = cleanIds(ids);
  if (clean.length === 0) return;
  const target = activeAssigneeId(assigneeId);
  const changedCount = bulkUpdateTaskAssignee(clean, target);
  if (changedCount > 0) {
    const name = target ? (getPerson(target)?.name ?? null) : null;
    await recordActivity({
      action: "task.bulk.assignee",
      entityType: "task",
      entityId: null,
      brandId: null,
      summary: name
        ? `${changedCount} görevi ${name} kişisine atadı`
        : `${changedCount} görevin atamasını kaldırdı`,
    });
  }
  revalidatePath("/", "layout");
}

export async function bulkDeleteTasksAction(ids: string[]) {
  await requireManager();
  const clean = cleanIds(ids);
  const uploadPaths = listUploadPathsForTaskIds(clean);
  const changedCount = bulkDeleteTasks(clean);
  await deleteUploadedFiles(uploadPaths);
  if (changedCount > 0) {
    await recordActivity({
      action: "task.bulk.delete",
      entityType: "task",
      entityId: null,
      brandId: null,
      summary: `${changedCount} görevi sildi`,
    });
  }
  revalidatePath("/", "layout");
}
