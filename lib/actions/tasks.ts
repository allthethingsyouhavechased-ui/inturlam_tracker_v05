"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordActivity } from "@/lib/activity";
import {
  REPEAT_OPTIONS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUSES,
} from "@/lib/constants";
import { formatDateShort, todayISO } from "@/lib/date";
import { announceGuestTaskPlanned, announceGuestTaskStatus } from "@/lib/guestTaskCommunications";
import { assertWeightPoints } from "@/lib/progress";
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
  createNextOccurrence,
  createTask,
  deleteTask,
  getTask,
  setTaskArchived,
  updateTaskAssignee,
  updateTaskDetails,
  updateTaskDueDate,
  updateTaskPriority,
  updateTaskRepeat,
  updateTaskStatus,
  updateTaskWeight,
} from "@/lib/repositories/tasks";
import type { TaskPriority, TaskStatus } from "@/lib/types";
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
  await requireSession();
  const contentItemId = String(formData.get("contentItemId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const priorityRaw = String(formData.get("priority") ?? "Normal") as TaskPriority;
  const priority = TASK_PRIORITIES.includes(priorityRaw) ? priorityRaw : "Normal";

  if (!contentItemId) throw new Error("İçerik bulunamadı.");
  if (!title) throw new Error("Görev başlığı zorunlu.");
  if (title.length > 200) throw new Error("Görev başlığı en fazla 200 karakter olabilir.");

  const id = createTask({
    contentItemId,
    title,
    assigneeId: cleanText(formData.get("assigneeId")),
    dueDate: requiredDate(formData.get("dueDate")),
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
  const changed = updateTaskStatus(taskId, status, actor.id);
  if (changed) {
    if (task?.origin === "guest") {
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
        brandId: task?.brand_id ?? null,
        summary: `“${task?.title ?? "Görev"}” görevini ${TASK_STATUS_LABEL[status]} durumuna aldı`,
      });
    }
  }

  // Tekrar eden görev tamamlandıysa bir sonraki örneğini aç. Yeni görev
  // "Beklemede" başladığı için bu dal tekrar tetiklenmez (sonsuz döngü yok).
  if (changed && status === "Yayinlandi" && task && (task.repeat_days ?? 0) > 0) {
    createNextOccurrence(task, todayISO());
    await recordActivity({
      action: "task.repeat",
      entityType: "task",
      entityId: taskId,
      brandId: task.brand_id,
      summary: `“${task.title}” tekrar eden görevinin bir sonraki örneği açıldı`,
    });
  }

  revalidatePath("/", "layout");
}

export async function setTaskRepeatAction(taskId: string, repeatDays: number) {
  await requireSession();
  if (!REPEAT_OPTIONS.some((o) => o.days === repeatDays)) {
    throw new Error("Geçersiz tekrar aralığı.");
  }
  const task = getTask(taskId);
  if (!task) throw new Error("Görev bulunamadı.");
  if (repeatDays > 0 && !task.due_date) throw new Error("Tekrar eklemeden önce teslim tarihi atanmalı.");

  updateTaskRepeat(taskId, repeatDays > 0 ? repeatDays : null);
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
  updateTaskPriority(taskId, priority);
  await recordActivity({
    action: "task.priority",
    entityType: "task",
    entityId: taskId,
    brandId: task?.brand_id ?? null,
    summary: `“${task?.title ?? "Görev"}” önceliğini ${TASK_PRIORITY_LABEL[priority]} yaptı`,
  });
  revalidatePath("/", "layout");
}

export async function setTaskAssigneeAction(
  taskId: string,
  assigneeId: string | null,
) {
  await requireSession();
  const target = assigneeId && assigneeId.length > 0 ? assigneeId : null;
  const task = getTask(taskId);
  updateTaskAssignee(taskId, target);
  const name = target ? (getPerson(target)?.name ?? null) : null;
  await recordActivity({
    action: "task.assignee",
    entityType: "task",
    entityId: taskId,
    brandId: task?.brand_id ?? null,
    summary: name
      ? `“${task?.title ?? "Görev"}” görevini ${name} kişisine atadı`
      : `“${task?.title ?? "Görev"}” görevinin atamasını kaldırdı`,
  });
  revalidatePath("/", "layout");
}

export async function setTaskDueDateAction(taskId: string, dueDate: string | null) {
  const actor = await requireSession();
  const task = getTask(taskId);
  if (!task) throw new Error("Görev bulunamadı.");
  const cleanDueDate = requiredDate(dueDate);
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

export async function updateTaskDetailsAction(formData: FormData) {
  const actor = await requireSession();
  const id = String(formData.get("taskId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!id) throw new Error("Görev bulunamadı.");
  if (!title) throw new Error("Görev başlığı zorunlu.");
  if (title.length > 200) throw new Error("Görev başlığı en fazla 200 karakter olabilir.");
  const notes = cleanText(formData.get("notes"));
  if ((notes?.length ?? 0) > 5000) throw new Error("Görev notu en fazla 5000 karakter olabilir.");
  const notifyMessage = cleanText(formData.get("notifyMessage"));
  if ((notifyMessage?.length ?? 0) > 1000) throw new Error("Bildirim notu en fazla 1000 karakter olabilir.");
  const task = getTask(id);

  const images = extractImageFiles(formData);
  validateImageFiles(images);

  const dueDate = requiredDate(formData.get("dueDate"));
  await withSavedImageFiles(images, "tasks", (saved) =>
    updateTaskDetails({ id, title, dueDate, notes }, saved),
  );

  if (task?.origin === "guest" && !task.due_date) {
    await announceGuestTaskPlanned({ actor, taskId: id, taskTitle: title, brandId: task.brand_id });
  } else {
    await recordActivity({
      action: "task.details",
      entityType: "task",
      entityId: id,
      brandId: task?.brand_id ?? null,
      summary: `“${title}” görev detaylarını güncelledi`,
    });
  }

  notifyTaskUpdate({
    actor,
    taskId: id,
    taskTitle: title,
    brandId: task?.brand_id ?? null,
    assigneeId: task?.assignee_id ?? null,
    message: notifyMessage,
  });

  revalidatePath("/", "layout");
}

export async function setTaskWeightAction(taskId: string, weightPoints: number) {
  const actor = await requireSession();
  if (actor.is_manager !== 1) throw new Error("Görev ağırlığını yalnızca yöneticiler değiştirebilir.");
  const task = getTask(taskId);
  if (!task) throw new Error("Görev bulunamadı.");
  updateTaskWeight(taskId, assertWeightPoints(weightPoints));
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
  const uploadPaths = listUploadPathsForTaskIds([taskId]);
  deleteTask(taskId);
  await deleteUploadedFiles(uploadPaths);
  await recordActivity({
    action: "task.delete",
    entityType: "task",
    entityId: null,
    brandId: task?.brand_id ?? null,
    summary: `“${task?.title ?? "Görev"}” görevini sildi`,
  });
  revalidatePath("/", "layout");
  if (task) {
    redirect(`/brands/${task.brand_id}/content/${task.content_item_id}`);
  }
  redirect("/");
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
  const changedCount = bulkUpdateTaskStatus(clean, status, actor.id);
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
}

export async function bulkSetTaskPriorityAction(
  ids: string[],
  priority: TaskPriority,
) {
  await requireSession();
  if (!TASK_PRIORITIES.includes(priority)) throw new Error("Geçersiz öncelik.");
  const clean = cleanIds(ids);
  bulkUpdateTaskPriority(clean, priority);
  if (clean.length > 0) {
    await recordActivity({
      action: "task.bulk.priority",
      entityType: "task",
      entityId: null,
      brandId: null,
      summary: `${clean.length} görevin önceliğini ${TASK_PRIORITY_LABEL[priority]} yaptı`,
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
  const target = assigneeId && assigneeId.length > 0 ? assigneeId : null;
  bulkUpdateTaskAssignee(clean, target);
  if (clean.length > 0) {
    const name = target ? (getPerson(target)?.name ?? null) : null;
    await recordActivity({
      action: "task.bulk.assignee",
      entityType: "task",
      entityId: null,
      brandId: null,
      summary: name
        ? `${clean.length} görevi ${name} kişisine atadı`
        : `${clean.length} görevin atamasını kaldırdı`,
    });
  }
  revalidatePath("/", "layout");
}

export async function bulkDeleteTasksAction(ids: string[]) {
  await requireManager();
  const clean = cleanIds(ids);
  const uploadPaths = listUploadPathsForTaskIds(clean);
  bulkDeleteTasks(clean);
  await deleteUploadedFiles(uploadPaths);
  if (clean.length > 0) {
    await recordActivity({
      action: "task.bulk.delete",
      entityType: "task",
      entityId: null,
      brandId: null,
      summary: `${clean.length} görevi sildi`,
    });
  }
  revalidatePath("/", "layout");
}
