"use server";

import { revalidatePath } from "next/cache";
import { isTaskShared } from "@/lib/taskSharing";
import { getCurrentActor, requireGuestSession, requireSession } from "@/lib/identity";
import {
  announceGuestComment,
  announceGuestTaskCreated,
  announceTeamSharedReply,
} from "@/lib/guestTaskCommunications";
import { getTask } from "@/lib/repositories/tasks";
import { addSharedComment, createGuestTask, deleteGuestOwnedSharedAttachment, getGuestTask, updateGuestTask } from "@/lib/repositories/guestTasks";
import { deleteUploadedFile, extractImageFiles, validateImageFiles, withSavedImageFiles } from "@/lib/uploads";

function text(formData: FormData, key: string, max: number): string {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${key === "title" ? "Başlık" : "Alan"} zorunlu.`);
  if (value.length > max) throw new Error(`Metin en fazla ${max} karakter olabilir.`);
  return value;
}

function requestedDate(formData: FormData): string {
  const value = String(formData.get("requestedDate") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("İstenen tarih zorunlu ve geçerli olmalı.");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error("İstenen tarih geçersiz.");
  return value;
}

export async function createGuestTaskAction(formData: FormData) {
  const actor = await requireGuestSession();
  const title = text(formData, "title", 200);
  const brief = text(formData, "brief", 5000);
  const images = extractImageFiles(formData);
  validateImageFiles(images);
  const date = requestedDate(formData);
  const taskId = await withSavedImageFiles(images, "guest-tasks", (saved) =>
    createGuestTask({ brandId: actor.brand.id, accountId: actor.account_id, title, brief, requestedDate: date, attachments: saved }),
  );
  await announceGuestTaskCreated({
    guestAccountId: actor.account_id,
    guestName: `${actor.brand.name} Guest`,
    taskId,
    taskTitle: title,
    brandId: actor.brand.id,
  });
  revalidatePath("/guest", "layout");
  return taskId;
}

export async function updateGuestTaskAction(formData: FormData) {
  const actor = await requireGuestSession();
  const taskId = String(formData.get("taskId") ?? "").trim();
  if (!getGuestTask(taskId, actor.brand.id, actor.account_id)) throw new Error("Görev bulunamadı.");
  const updated = updateGuestTask({ taskId, brandId: actor.brand.id, title: text(formData, "title", 200), brief: text(formData, "brief", 5000), requestedDate: requestedDate(formData) });
  if (!updated) throw new Error("Çalışma başladığı için brief artık düzenlenemez.");
  revalidatePath(`/guest/tasks/${taskId}`);
}

export async function addGuestSharedCommentAction(formData: FormData) {
  const actor = await requireGuestSession();
  const taskId = String(formData.get("taskId") ?? "").trim();
  if (!getGuestTask(taskId, actor.brand.id, actor.account_id)) throw new Error("Görev bulunamadı.");
  const task = getTask(taskId);
  if (!task) throw new Error("Görev bulunamadı.");
  const body = text(formData, "body", 2000);
  const images = extractImageFiles(formData);
  validateImageFiles(images);
  await withSavedImageFiles(images, "guest-tasks", (saved) =>
    addSharedComment({ taskId, accountId: actor.account_id, authorName: `${actor.brand.name} Guest`, body }, saved),
  );
  await announceGuestComment({
    guestAccountId: actor.account_id,
    guestName: `${actor.brand.name} Guest`,
    taskId,
    taskTitle: task.title,
    brandId: actor.brand.id,
    assigneeId: task.assignee_id,
    body,
  });
  revalidatePath(`/guest/tasks/${taskId}`);
}

export async function deleteGuestSharedAttachmentAction(taskId: string, attachmentId: string) {
  const actor = await requireGuestSession();
  const task = getGuestTask(taskId, actor.brand.id, actor.account_id);
  if (!task) throw new Error("Görev bulunamadı.");
  if (!task.editable) throw new Error("Çalışma başladığı için mevcut ekler değiştirilemez.");
  const attachment = deleteGuestOwnedSharedAttachment(attachmentId, taskId, actor.account_id);
  if (!attachment) return;
  await deleteUploadedFile(attachment.file_path);
  revalidatePath(`/guest/tasks/${taskId}`);
}

export async function addTeamSharedCommentAction(formData: FormData) {
  const person = await requireSession();
  const actor = await getCurrentActor();
  if (!actor || actor.kind !== "team" || actor.person.id !== person.id) throw new Error("Ekip oturumu gerekli.");
  const taskId = String(formData.get("taskId") ?? "").trim();
  const task = getTask(taskId);
  if (!task || !isTaskShared(taskId)) throw new Error("Paylaşılan görev bulunamadı.");
  const body = text(formData, "body", 2000);
  const images = extractImageFiles(formData);
  validateImageFiles(images);
  await withSavedImageFiles(images, "guest-tasks", (saved) =>
    addSharedComment({ taskId, accountId: actor.account_id, authorName: person.name, body }, saved),
  );
  await announceTeamSharedReply({
    actor: person,
    taskId,
    taskTitle: task.title,
    brandId: task.brand_id,
    body,
  });
  revalidatePath(`/tasks/${taskId}`);
}
