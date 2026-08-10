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
import { getCurrentPerson } from "@/lib/identity";
import { notifyTaskUpdate } from "@/lib/notifications";
import { setPersonalTaskTarget } from "@/lib/repositories/personalTargets";
import { getPerson } from "@/lib/repositories/people";
import {
  addTaskAttachment,
  deleteTaskAttachment,
  getTaskAttachment,
} from "@/lib/repositories/taskAttachments";
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
} from "@/lib/repositories/tasks";
import type { TaskPriority, TaskStatus } from "@/lib/types";
import {
  deleteUploadedFile,
  extractImageFiles,
  saveImageFiles,
  validateImageFiles,
} from "@/lib/uploads";

function cleanText(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length > 0 ? s : null;
}

export async function createTaskAction(formData: FormData): Promise<string> {
  const contentItemId = String(formData.get("contentItemId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const priorityRaw = String(formData.get("priority") ?? "Normal") as TaskPriority;
  const priority = TASK_PRIORITIES.includes(priorityRaw) ? priorityRaw : "Normal";

  if (!contentItemId) throw new Error("İçerik bulunamadı.");
  if (!title) throw new Error("Görev başlığı zorunlu.");

  const id = createTask({
    contentItemId,
    title,
    assigneeId: cleanText(formData.get("assigneeId")),
    dueDate: cleanText(formData.get("dueDate")),
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
  if (!TASK_STATUSES.includes(status)) throw new Error("Geçersiz durum.");
  const task = getTask(taskId);
  const actor = await getCurrentPerson();
  const changed = updateTaskStatus(taskId, status, actor?.id ?? null);
  if (changed) {
    await recordActivity({
      action: "task.status",
      entityType: "task",
      entityId: taskId,
      brandId: task?.brand_id ?? null,
      summary: `“${task?.title ?? "Görev"}” görevini ${TASK_STATUS_LABEL[status]} durumuna aldı`,
    });
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
  if (!REPEAT_OPTIONS.some((o) => o.days === repeatDays)) {
    throw new Error("Geçersiz tekrar aralığı.");
  }
  const task = getTask(taskId);
  if (!task) throw new Error("Görev bulunamadı.");

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
  const task = getTask(taskId);
  updateTaskDueDate(taskId, dueDate);
  await recordActivity({
    action: "task.duedate",
    entityType: "task",
    entityId: taskId,
    brandId: task?.brand_id ?? null,
    summary: dueDate
      ? `“${task?.title ?? "Görev"}” teslim tarihini ${formatDateShort(dueDate)} yaptı`
      : `“${task?.title ?? "Görev"}” teslim tarihini kaldırdı`,
  });
  revalidatePath("/", "layout");
}

export async function setPersonalTaskTargetAction(
  taskId: string,
  targetDate: string | null,
) {
  const person = await getCurrentPerson();
  if (!person) throw new Error("Kişisel hedef belirlemek için giriş yapmalısın.");

  const cleanTarget = targetDate?.trim() || null;
  setPersonalTaskTarget(taskId, person.id, cleanTarget, todayISO());
  // Hedef artık yalnızca Panom'da değil, Görevler panosunda/listesinde ve
  // takvimde de gösteriliyor — tek bir sayfayı tazelemek yetmiyor.
  revalidatePath("/", "layout");
}

export async function updateTaskDetailsAction(formData: FormData) {
  const id = String(formData.get("taskId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  if (!id) throw new Error("Görev bulunamadı.");
  if (!title) throw new Error("Görev başlığı zorunlu.");
  if (title.length > 200) throw new Error("Görev başlığı en fazla 200 karakter olabilir.");
  const task = getTask(id);

  const images = extractImageFiles(formData);
  validateImageFiles(images);

  updateTaskDetails({
    id,
    title,
    dueDate: cleanText(formData.get("dueDate")),
    notes: cleanText(formData.get("notes")),
  });

  const saved = await saveImageFiles(images, "tasks");
  for (const { filePath, originalName } of saved) {
    addTaskAttachment({ taskId: id, filePath, originalName });
  }

  await recordActivity({
    action: "task.details",
    entityType: "task",
    entityId: id,
    brandId: task?.brand_id ?? null,
    summary: `“${title}” görev detaylarını güncelledi`,
  });

  const actor = await getCurrentPerson();
  if (actor) {
    notifyTaskUpdate({
      actor,
      taskId: id,
      taskTitle: title,
      brandId: task?.brand_id ?? null,
      assigneeId: task?.assignee_id ?? null,
      message: cleanText(formData.get("notifyMessage")),
    });
  }

  revalidatePath("/", "layout");
}

// Elle arşivleme / arşivden çıkarma. Görevin DURUMU değişmez — arşiv yalnızca
// "panoda görünsün mü" sorusunu cevaplar. Yayınlanan işler zaten
// ARCHIVE_AFTER_DAYS gün sonra kendiliğinden arşivlenir; bu action iki uç durum
// için: işi erken temizlemek ve yanlışlıkla arşivleneni geri getirmek.
export async function setTaskArchivedAction(taskId: string, archived: boolean) {
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
  const attachment = getTaskAttachment(attachmentId);
  if (!attachment) return;
  deleteTaskAttachment(attachmentId);
  await deleteUploadedFile(attachment.file_path);
  revalidatePath("/", "layout");
}

export async function deleteTaskAction(taskId: string) {
  const task = getTask(taskId);
  deleteTask(taskId);
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
  return Array.from(
    new Set(ids.map((id) => String(id ?? "").trim()).filter(Boolean)),
  );
}

export async function bulkSetTaskStatusAction(ids: string[], status: TaskStatus) {
  if (!TASK_STATUSES.includes(status)) throw new Error("Geçersiz durum.");
  const clean = cleanIds(ids);
  const actor = await getCurrentPerson();
  const changedCount = bulkUpdateTaskStatus(clean, status, actor?.id ?? null);
  if (changedCount > 0) {
    await recordActivity({
      action: "task.bulk.status",
      entityType: "task",
      entityId: null,
      brandId: null,
      summary: `${changedCount} görevi ${TASK_STATUS_LABEL[status]} durumuna aldı`,
    });
  }
  revalidatePath("/", "layout");
}

export async function bulkSetTaskPriorityAction(
  ids: string[],
  priority: TaskPriority,
) {
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
  const clean = cleanIds(ids);
  bulkDeleteTasks(clean);
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
