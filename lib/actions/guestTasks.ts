"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentActor, requireGuestSession, requireSession } from "@/lib/identity";
import { getTask } from "@/lib/repositories/tasks";
import { addSharedAttachments, addSharedComment, createGuestTask, deleteSharedAttachment, getGuestTask, getSharedAttachment, updateGuestTask } from "@/lib/repositories/guestTasks";
import { deleteUploadedFile, extractImageFiles, saveImageFiles, validateImageFiles } from "@/lib/uploads";

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
  const saved = await saveImageFiles(images, "guest-tasks");
  const taskId = createGuestTask({ brandId: actor.brand.id, accountId: actor.account_id, title, brief, requestedDate: requestedDate(formData), attachments: saved });
  revalidatePath("/guest", "layout");
  redirect(`/guest/tasks/${taskId}`);
}

export async function updateGuestTaskAction(formData: FormData) {
  const actor = await requireGuestSession();
  const taskId = String(formData.get("taskId") ?? "").trim();
  if (!getGuestTask(taskId, actor.brand.id)) throw new Error("Görev bulunamadı.");
  const updated = updateGuestTask({ taskId, brandId: actor.brand.id, title: text(formData, "title", 200), brief: text(formData, "brief", 5000), requestedDate: requestedDate(formData) });
  if (!updated) throw new Error("Çalışma başladığı için brief artık düzenlenemez.");
  revalidatePath(`/guest/tasks/${taskId}`);
}

export async function addGuestSharedCommentAction(formData: FormData) {
  const actor = await requireGuestSession();
  const taskId = String(formData.get("taskId") ?? "").trim();
  if (!getGuestTask(taskId, actor.brand.id)) throw new Error("Görev bulunamadı.");
  const body = text(formData, "body", 2000);
  addSharedComment({ taskId, accountId: actor.account_id, authorName: `${actor.brand.name} Guest`, body });
  const images = extractImageFiles(formData);
  validateImageFiles(images);
  addSharedAttachments({ taskId, accountId: actor.account_id, attachments: await saveImageFiles(images, "guest-tasks") });
  revalidatePath(`/guest/tasks/${taskId}`);
}

export async function deleteGuestSharedAttachmentAction(taskId: string, attachmentId: string) {
  const actor = await requireGuestSession();
  const task = getGuestTask(taskId, actor.brand.id);
  if (!task) throw new Error("Görev bulunamadı.");
  if (!task.editable) throw new Error("Çalışma başladığı için mevcut ekler değiştirilemez.");
  const attachment = getSharedAttachment(attachmentId, taskId);
  if (!attachment) return;
  deleteSharedAttachment(attachmentId, taskId);
  await deleteUploadedFile(attachment.file_path);
  revalidatePath(`/guest/tasks/${taskId}`);
}

export async function addTeamSharedCommentAction(formData: FormData) {
  const person = await requireSession();
  const actor = await getCurrentActor();
  if (!actor || actor.kind !== "team" || actor.person.id !== person.id) throw new Error("Ekip oturumu gerekli.");
  const taskId = String(formData.get("taskId") ?? "").trim();
  if (!getTask(taskId)) throw new Error("Görev bulunamadı.");
  const body = text(formData, "body", 2000);
  addSharedComment({ taskId, accountId: actor.account_id, authorName: person.name, body });
  const images = extractImageFiles(formData);
  validateImageFiles(images);
  addSharedAttachments({ taskId, accountId: actor.account_id, attachments: await saveImageFiles(images, "guest-tasks") });
  revalidatePath(`/tasks/${taskId}`);
}
