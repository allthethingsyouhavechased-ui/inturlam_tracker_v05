"use server";

import { revalidatePath } from "next/cache";
import { isTaskShared } from "@/lib/taskSharing";
import { getCurrentActor, requireGuestSession, requireSession } from "@/lib/identity";
import {
  announceGuestComment,
  announceGuestRequestCreated,
  announceTeamSharedReply,
} from "@/lib/guestTaskCommunications";
import { getTask } from "@/lib/repositories/tasks";
import { addSharedComment, deleteGuestOwnedSharedAttachment, getGuestTask, updateGuestTask } from "@/lib/repositories/guestTasks";
import { createClientRequest } from "@/lib/repositories/clientRequests";
import { ExpectedActionError, runAction, runAfterCommit, type ActionResult } from "@/lib/actionResult";
import { DEFAULT_GUEST_REQUEST_DEPARTMENT } from "@/lib/clientRequests";
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

/**
 * Müşteri portalından gelen yeni istek artık DOĞRUDAN üretim görevi açmıyor:
 * önce TALEP kaydı oluşuyor ve normal değerlendirme kuyruğuna giriyor
 * (Yeni → İncelemede → Bilgi/Revize Bekleniyor → Onaylandı | Reddedildi).
 * Görev yalnızca kabulde, tek bir kayıt olarak açılıyor.
 *
 * Eski guest görevleri OLDUĞU GİBİ duruyor; geriye dönük taleple
 * ilişkilendirilmiyor ve silinmiyor.
 */
export async function createGuestRequestAction(formData: FormData): Promise<ActionResult<string>> {
  const actor = await requireGuestSession();
  return runAction<string>("guest.createRequest", async () => {
    let title: string;
    let brief: string;
    let date: string;
    try {
      title = text(formData, "title", 200);
      brief = text(formData, "brief", 5000);
      date = requestedDate(formData);
    } catch (error) {
      throw new ExpectedActionError(error instanceof Error ? error.message : "Form eksik.");
    }
    const images = extractImageFiles(formData);
    try { validateImageFiles(images); }
    catch (error) { throw new ExpectedActionError(error instanceof Error ? error.message : "Görseller kabul edilmedi."); }

    const requestId = await withSavedImageFiles(images, "guest-tasks", (saved) =>
      createClientRequest(
        {
          brandId: actor.brand.id,
          title,
          description: brief,
          requestedByName: actor.username,
          source: "Müşteri portalı",
          referenceUrl: null,
          // Hedef departman değerlendirmede belirleniyor; müşteri seçmiyor.
          department: DEFAULT_GUEST_REQUEST_DEPARTMENT,
          contentType: "Diger",
          // İSTENEN tarih müşteriden; İÇ teslim tarihini ekip veriyor.
          dueDate: null,
          requestedDate: date,
          createdById: null,
          createdByAccountId: actor.account_id,
          origin: "guest",
        },
        saved,
      ),
    );

    await runAfterCommit("guest.createRequest", () =>
      announceGuestRequestCreated({
        guestName: `${actor.brand.name} Guest`,
        requestId,
        requestTitle: title,
        brandId: actor.brand.id,
      }),
    );
    revalidatePath("/guest", "layout");
    revalidatePath("/requests", "layout");
    return { ok: true as const, value: requestId, message: "Talebin değerlendirmeye alındı." };
  });
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
