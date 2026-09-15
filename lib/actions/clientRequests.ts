"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordActivity } from "@/lib/activity";
import { CONTENT_TYPES, TASK_DIFFICULTIES, TASK_PRIORITIES } from "@/lib/constants";
import { normalizeDepartment } from "@/lib/departments";
import { requireSession } from "@/lib/identity";
import { notifyTaskUpdate } from "@/lib/notifications";
import { canReviewClientRequests } from "@/lib/requestAccess";
import { ExpectedActionError, runAction, runAfterCommit, type ActionResult } from "@/lib/actionResult";
import {
  addClientRequestComment,
  approveClientRequest,
  createClientRequest,
  deleteClientRequest,
  getClientRequest,
  listClientRequestAttachments,
  rejectClientRequest,
  requestClientRequestInfo,
  resubmitClientRequest,
  updateClientRequestDetails,
  updateClientRequestReview,
  type ClientRequestReviewInput,
} from "@/lib/repositories/clientRequests";
import type { ContentType, Person, TaskDifficulty, TaskPriority } from "@/lib/types";
import {
  cloneUploadedFile,
  deleteUploadedFile,
  extractImageFiles,
  saveImageFiles,
  validateImageFiles,
} from "@/lib/uploads";

function clean(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function cleanDate(value: FormDataEntryValue | null): string | null {
  const date = clean(value);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error("Geçersiz tarih.");
  }
  if (date) {
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new Error("Geçersiz tarih.");
    }
  }
  return date;
}

function cleanReferenceUrl(value: FormDataEntryValue | null): string | null {
  const referenceUrl = clean(value);
  if (!referenceUrl) return null;
  try {
    const parsed = new URL(referenceUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error();
    return parsed.toString();
  } catch {
    throw new Error("Referans bağlantısı http veya https ile başlamalı.");
  }
}

function assertReviewer(person: Person): void {
  if (!canReviewClientRequests(person)) {
    throw new Error("Bu işlem yalnızca talep değerlendirme sorumlularına açık.");
  }
}

function reviewInput(formData: FormData, reviewerId: string): ClientRequestReviewInput {
  const id = String(formData.get("requestId") ?? "").trim();
  const department = normalizeDepartment(formData.get("department"));
  const assigneeId = String(formData.get("assigneeId") ?? "").trim();
  const priority = String(formData.get("priority") ?? "Normal") as TaskPriority;
  const difficulty = String(formData.get("difficulty") ?? "Orta") as TaskDifficulty;
  if (!id) throw new Error("Talep bulunamadı.");
  if (!department) throw new Error("Hedef departman zorunlu.");
  if (!assigneeId) throw new Error("Onay öncesinde görev sahibi seçilmeli.");
  if (!TASK_PRIORITIES.includes(priority)) throw new Error("Geçersiz öncelik.");
  if (!TASK_DIFFICULTIES.includes(difficulty)) throw new Error("Geçersiz zorluk derecesi.");
  const weightPoints = Number(formData.get("weightPoints") ?? 1);
  if (!Number.isInteger(weightPoints) || weightPoints < 1 || weightPoints > 100) {
    throw new Error("Ağırlık puanı 1 ile 100 arasında bir tam sayı olmalı.");
  }
  const dueDate = cleanDate(formData.get("dueDate"));
  if (!dueDate) throw new Error("Onay ve planlama için teslim tarihi zorunlu.");
  return {
    id,
    reviewerId,
    department,
    assigneeId,
    priority,
    difficulty,
    weightPoints,
    dueDate,
  };
}

function requestDetailsInput(formData: FormData) {
  const brandId = String(formData.get("brandId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const department = normalizeDepartment(formData.get("department"));
  const contentType = String(formData.get("contentType") ?? "Diger") as ContentType;

  if (!brandId) throw new Error("Marka zorunlu.");
  if (!title) throw new Error("Talep başlığı zorunlu.");
  if (title.length > 180) throw new Error("Talep başlığı en fazla 180 karakter olabilir.");
  if (!description) throw new Error("Müşteri talebinin ayrıntısı zorunlu.");
  if (description.length > 5000) throw new Error("Talep ayrıntısı en fazla 5000 karakter olabilir.");
  if (!department) throw new Error("Hedef departman zorunlu.");
  if (!CONTENT_TYPES.includes(contentType)) throw new Error("Geçersiz iş türü.");

  return {
    brandId,
    title,
    description,
    requestedByName: clean(formData.get("requestedByName")),
    source: clean(formData.get("source")),
    referenceUrl: cleanReferenceUrl(formData.get("referenceUrl")),
    department,
    contentType,
    dueDate: cleanDate(formData.get("dueDate")),
  };
}

export async function createClientRequestAction(formData: FormData) {
  const actor = await requireSession();
  assertReviewer(actor);
  const details = requestDetailsInput(formData);
  const images = extractImageFiles(formData);
  validateImageFiles(images);

  const savedImages = await saveImageFiles(images, "requests");
  let id: string;
  try {
    id = createClientRequest({
      ...details,
      createdById: actor.id,
    }, savedImages);
  } catch (error) {
    for (const image of savedImages) await deleteUploadedFile(image.filePath);
    throw error;
  }
  await recordActivity({
    action: "request.create",
    entityType: "request",
    entityId: id,
    brandId: details.brandId,
    summary: `“${details.title}” müşteri talebini kaydetti`,
  });
  revalidatePath("/requests");
  redirect(`/requests/${id}`);
}

export async function updateClientRequestAction(formData: FormData) {
  const actor = await requireSession();
  assertReviewer(actor);
  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!requestId) throw new Error("Talep bulunamadı.");
  const request = getClientRequest(requestId);
  if (!request) throw new Error("Talep bulunamadı.");
  const details = requestDetailsInput(formData);
  const images = extractImageFiles(formData);
  validateImageFiles(images);

  const savedImages = await saveImageFiles(images, "requests");
  try {
    updateClientRequestDetails({ id: requestId, ...details }, savedImages);
  } catch (error) {
    for (const image of savedImages) await deleteUploadedFile(image.filePath);
    throw error;
  }
  await recordActivity({
    action: "request.update",
    entityType: "request",
    entityId: requestId,
    brandId: details.brandId,
    summary: `“${details.title}” müşteri talebini güncelledi`,
  });
  revalidatePath(`/requests/${requestId}`);
  revalidatePath("/requests");
}

export async function deleteClientRequestAction(requestId: string) {
  const actor = await requireSession();
  assertReviewer(actor);
  const request = getClientRequest(requestId);
  if (!request) throw new Error("Talep bulunamadı.");
  const attachments = listClientRequestAttachments(requestId);
  deleteClientRequest(requestId);
  for (const attachment of attachments) {
    await deleteUploadedFile(attachment.file_path);
  }
  await recordActivity({
    action: "request.delete",
    entityType: "request",
    entityId: null,
    brandId: request.brand_id,
    summary: `“${request.title}” müşteri talebini sildi`,
  });
  revalidatePath("/requests", "layout");
  redirect("/requests");
}

export async function updateClientRequestReviewAction(formData: FormData) {
  const reviewer = await requireSession();
  assertReviewer(reviewer);
  const input = reviewInput(formData, reviewer.id);
  const request = getClientRequest(input.id);
  updateClientRequestReview(input);
  await recordActivity({
    action: "request.review",
    entityType: "request",
    entityId: input.id,
    brandId: request?.brand_id ?? null,
    summary: `“${request?.title ?? "Talep"}” talebini incelemeye aldı`,
  });
  revalidatePath("/requests", "layout");
}

export async function addClientRequestCommentAction(formData: FormData) {
  const reviewer = await requireSession();
  assertReviewer(reviewer);
  const requestId = String(formData.get("requestId") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!requestId) throw new Error("Talep bulunamadı.");
  if (!body) throw new Error("Yorum boş olamaz.");
  if (body.length > 2000) throw new Error("Yorum en fazla 2000 karakter olabilir.");
  const request = getClientRequest(requestId);
  if (!request) throw new Error("Talep bulunamadı.");
  addClientRequestComment({ requestId, authorId: reviewer.id, body });
  await recordActivity({
    action: "request.comment",
    entityType: "request",
    entityId: requestId,
    brandId: request.brand_id,
    summary: `“${request.title}” talebine değerlendirme notu ekledi`,
  });
  revalidatePath(`/requests/${requestId}`);
}

export async function approveClientRequestAction(formData: FormData) {
  const reviewer = await requireSession();
  assertReviewer(reviewer);
  const input = reviewInput(formData, reviewer.id);
  const request = getClientRequest(input.id);
  if (!request) throw new Error("Talep bulunamadı.");
  const requestAttachments = listClientRequestAttachments(input.id);
  const taskAttachments = [] as Array<{ filePath: string; originalName: string | null }>;
  let converted;
  try {
    for (const attachment of requestAttachments) {
      const copy = await cloneUploadedFile(attachment.file_path, "tasks");
      taskAttachments.push({ ...copy, originalName: attachment.original_name });
    }
    converted = approveClientRequest(input, taskAttachments);
  } catch (error) {
    for (const attachment of taskAttachments) {
      await deleteUploadedFile(attachment.filePath);
    }
    throw error;
  }
  await recordActivity({
    action: "request.approve",
    entityType: "request",
    entityId: input.id,
    brandId: request.brand_id,
    summary: `“${request.title}” talebini onaylayıp göreve dönüştürdü`,
  });
  await recordActivity({
    action: "task.create.from-request",
    entityType: "task",
    entityId: converted.taskId,
    brandId: request.brand_id,
    summary: `“${request.title}” görevini müşteri talebinden oluşturdu`,
  });
  notifyTaskUpdate({
    actor: reviewer,
    taskId: converted.taskId,
    taskTitle: request.title,
    brandId: request.brand_id,
    assigneeId: input.assigneeId,
    message: "Müşteri talebi onaylandı ve görev sana atandı.",
  });
  revalidatePath("/", "layout");
  redirect(`/tasks/${converted.taskId}`);
}

export async function rejectClientRequestAction(formData: FormData) {
  const reviewer = await requireSession();
  assertReviewer(reviewer);
  const requestId = String(formData.get("requestId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const request = getClientRequest(requestId);
  if (!request) throw new Error("Talep bulunamadı.");
  rejectClientRequest({ id: requestId, reviewerId: reviewer.id, reason });
  await recordActivity({
    action: "request.reject",
    entityType: "request",
    entityId: requestId,
    brandId: request.brand_id,
    summary: `“${request.title}” talebini reddetti`,
  });
  revalidatePath("/requests", "layout");
}

/**
 * "Bilgi/Revize bekleniyor": talep reddedilmiyor, eksik bilgi isteniyor.
 * Gerekçe zorunlu; talebi açan taraf ne düzelteceğini görüyor ve
 * "Tekrar değerlendirmeye gönder" ile kuyruğa geri koyabiliyor.
 */
export async function requestClientRequestInfoAction(formData: FormData): Promise<ActionResult> {
  const reviewer = await requireSession();
  return runAction("request.requestInfo", async () => {
    assertReviewer(reviewer);
    const requestId = String(formData.get("requestId") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();
    if (!reason) throw new ExpectedActionError("Bilgi/revize isteği için gerekçe zorunlu.");
    if (reason.length > 2000) throw new ExpectedActionError("Gerekçe en fazla 2000 karakter olabilir.");
    const request = getClientRequest(requestId);
    if (!request) throw new ExpectedActionError("Talep bulunamadı.", "notFound");
    try {
      requestClientRequestInfo({ id: requestId, reviewerId: reviewer.id, reason });
    } catch (error) {
      throw new ExpectedActionError(error instanceof Error ? error.message : "Bilgi istenemedi.");
    }
    await runAfterCommit("request.requestInfo", () =>
      recordActivity({
        action: "request.info",
        entityType: "request",
        entityId: requestId,
        brandId: request.brand_id,
        summary: `“${request.title}” talebi için bilgi/revize istedi`,
      }),
    );
    revalidatePath("/requests", "layout");
    return { ok: true as const, message: "Bilgi/revize istendi." };
  });
}

/**
 * Talebi yeniden değerlendirmeye gönderir. Eski metin, ekler ve karar geçmişi
 * KORUNUR. Talebi açan ekip üyesi ya da bir değerlendirici çağırabilir.
 */
export async function resubmitClientRequestAction(requestId: string): Promise<ActionResult> {
  const actor = await requireSession();
  return runAction("request.resubmit", async () => {
    const request = getClientRequest(requestId);
    if (!request) throw new ExpectedActionError("Talep bulunamadı.", "notFound");
    const isOwner = request.created_by_id === actor.id;
    if (!isOwner && !canReviewClientRequests(actor)) {
      throw new ExpectedActionError("Bu talebi yeniden gönderme yetkin yok.", "forbidden");
    }
    try {
      resubmitClientRequest(requestId);
    } catch (error) {
      throw new ExpectedActionError(
        error instanceof Error ? error.message : "Talep yeniden gönderilemedi.",
      );
    }
    await runAfterCommit("request.resubmit", () =>
      recordActivity({
        action: "request.resubmit",
        entityType: "request",
        entityId: requestId,
        brandId: request.brand_id,
        summary: `“${request.title}” talebini tekrar değerlendirmeye gönderdi`,
      }),
    );
    revalidatePath("/requests", "layout");
    return { ok: true as const, message: "Talep yeniden değerlendirmeye gönderildi." };
  });
}
