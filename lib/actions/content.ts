"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordActivity } from "@/lib/activity";
import {
  CONTENT_STATUS_LABEL,
  CONTENT_STATUSES,
  CONTENT_TYPES,
} from "@/lib/constants";
import { requireSession } from "@/lib/identity";
import {
  createContentItem,
  deleteContentItem,
  getContentItem,
  setContentArchived,
  updateContentItem,
  updateContentStatus,
} from "@/lib/repositories/content";
import type { ContentStatus, ContentType } from "@/lib/types";

function cleanValue(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length > 0 ? s : null;
}

function cleanDate(value: FormDataEntryValue | null): string | null {
  const date = cleanValue(value);
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Geçersiz tarih.");
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error("Geçersiz tarih.");
  }
  return date;
}

export async function createContentItemAction(formData: FormData): Promise<string> {
  await requireSession();
  const brandId = String(formData.get("brandId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "") as ContentType;

  if (!brandId) throw new Error("Marka bulunamadı.");
  if (!title) throw new Error("Başlık zorunlu.");
  if (title.length > 200) throw new Error("Başlık en fazla 200 karakter olabilir.");
  if (!CONTENT_TYPES.includes(type)) throw new Error("Geçersiz içerik türü.");

  const id = createContentItem({
    brandId,
    title,
    type,
    targetDate: cleanDate(formData.get("targetDate")),
    assigneeId: cleanValue(formData.get("assigneeId")),
  });

  await recordActivity({
    action: "content.create",
    entityType: "content",
    entityId: id,
    brandId,
    summary: `“${title}” içeriğini oluşturdu`,
  });

  revalidatePath("/", "layout");
  return id;
}

export async function setContentStatusAction(
  contentId: string,
  status: ContentStatus,
) {
  await requireSession();
  if (!CONTENT_STATUSES.includes(status)) {
    throw new Error("Geçersiz durum.");
  }
  const content = getContentItem(contentId);
  updateContentStatus(contentId, status);
  await recordActivity({
    action: "content.status",
    entityType: "content",
    entityId: contentId,
    brandId: content?.brand_id ?? null,
    summary: `“${content?.title ?? "İçerik"}” durumunu ${CONTENT_STATUS_LABEL[status]} yaptı`,
  });
  revalidatePath("/", "layout");
}

export async function updateContentItemAction(formData: FormData) {
  await requireSession();
  const id = String(formData.get("contentId") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "") as ContentType;

  if (!id) throw new Error("İçerik bulunamadı.");
  if (!title) throw new Error("Başlık zorunlu.");
  if (title.length > 200) throw new Error("Başlık en fazla 200 karakter olabilir.");
  if (!CONTENT_TYPES.includes(type)) throw new Error("Geçersiz içerik türü.");

  const before = getContentItem(id);
  updateContentItem({
    id,
    title,
    type,
    targetDate: cleanDate(formData.get("targetDate")),
    assigneeId: cleanValue(formData.get("assigneeId")),
  });

  await recordActivity({
    action: "content.update",
    entityType: "content",
    entityId: id,
    brandId: before?.brand_id ?? null,
    summary: `“${title}” içeriğini güncelledi`,
  });

  revalidatePath("/", "layout");
}

export async function archiveContentItemAction(contentId: string) {
  await requireSession();
  const content = getContentItem(contentId);
  setContentArchived(contentId, true);
  await recordActivity({
    action: "content.archive",
    entityType: "content",
    entityId: contentId,
    brandId: content?.brand_id ?? null,
    summary: `“${content?.title ?? "İçerik"}” içeriğini arşivledi`,
  });
  revalidatePath("/", "layout");
}

export async function unarchiveContentItemAction(contentId: string) {
  await requireSession();
  const content = getContentItem(contentId);
  setContentArchived(contentId, false);
  await recordActivity({
    action: "content.unarchive",
    entityType: "content",
    entityId: contentId,
    brandId: content?.brand_id ?? null,
    summary: `“${content?.title ?? "İçerik"}” içeriğini arşivden çıkardı`,
  });
  revalidatePath("/", "layout");
}

export async function deleteContentItemAction(contentId: string) {
  await requireSession();
  const content = getContentItem(contentId);
  deleteContentItem(contentId);
  await recordActivity({
    action: "content.delete",
    entityType: "content",
    entityId: null,
    brandId: content?.brand_id ?? null,
    summary: `“${content?.title ?? "İçerik"}” içeriğini sildi`,
  });
  revalidatePath("/", "layout");
  if (content) {
    redirect(`/brands/${content.brand_id}`);
  }
  redirect("/");
}
