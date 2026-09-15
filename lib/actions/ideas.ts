"use server";

import { revalidatePath } from "next/cache";
import { recordActivity } from "@/lib/activity";
import {
  IDEA_STATUS_LABEL,
  isIdeaCategory,
  isIdeaStatus,
  normalizeIdeaSourceUrl,
  normalizeIdeaTags,
} from "@/lib/ideas";
import { requireTeamSession } from "@/lib/identity";
import {
  createIdea,
  deleteIdea,
  getIdea,
  setIdeaArchived,
  updateIdea,
  updateIdeaStatus,
} from "@/lib/repositories/ideas";
import { ExpectedActionError, runAction, type ActionResult } from "@/lib/actionResult";
import { canDeleteIdea } from "@/lib/ideas";

function requiredText(formData: FormData, key: string, label: string, max: number): string {
  const value = String(formData.get(key) ?? "").trim();
  if (!value || value.length > max) throw new Error(`${label} 1-${max} karakter olmalı.`);
  return value;
}

function optionalBrandId(formData: FormData): string | null {
  const value = String(formData.get("brandId") ?? "").trim();
  if (value === "__office__") return null;
  if (value.length > 80) throw new Error("Marka seçimi geçersiz.");
  if (!value) throw new Error("Fikir kapsamı seçilmeli.");
  return value;
}

function ideaValues(formData: FormData) {
  const category = String(formData.get("category") ?? "");
  const status = String(formData.get("status") ?? "Yeni");
  if (!isIdeaCategory(category)) throw new Error("Fikir kategorisi geçersiz.");
  if (!isIdeaStatus(status)) throw new Error("Fikir durumu geçersiz.");
  const source = normalizeIdeaSourceUrl(String(formData.get("sourceUrl") ?? ""));
  return {
    brandId: optionalBrandId(formData),
    category,
    status,
    title: requiredText(formData, "title", "Fikir başlığı", 180),
    body: requiredText(formData, "body", "Fikir açıklaması", 8000),
    sourceUrl: source.url,
    sourcePlatform: source.platform,
    tagsText: normalizeIdeaTags(String(formData.get("tags") ?? "")),
  };
}

function revalidateIdeaPaths(id: string, brandId: string | null): void {
  revalidatePath("/ideas");
  revalidatePath(`/ideas/${id}`);
  revalidatePath("/search");
  if (brandId) revalidatePath(`/brands/${brandId}`);
}

export async function createIdeaAction(formData: FormData): Promise<string> {
  const actor = await requireTeamSession();
  const values = ideaValues(formData);
  const id = createIdea({
    ...values,
    createdById: actor.person.id,
    createdByName: actor.person.name,
  });
  await recordActivity({
    action: "idea.create",
    entityType: "idea",
    entityId: id,
    brandId: values.brandId,
    summary: `“${values.title}” fikrini ${values.brandId ? "marka havuzuna" : "Ofis geneline"} ekledi`,
  });
  revalidateIdeaPaths(id, values.brandId);
  return id;
}

export async function updateIdeaAction(formData: FormData): Promise<void> {
  await requireTeamSession();
  const id = String(formData.get("ideaId") ?? "").trim();
  const current = getIdea(id);
  if (!current) throw new Error("Fikir bulunamadı.");
  const values = ideaValues(formData);
  updateIdea({ id, ...values });
  await recordActivity({
    action: "idea.update",
    entityType: "idea",
    entityId: id,
    brandId: values.brandId,
    summary: `“${values.title}” fikrini güncelledi`,
  });
  revalidateIdeaPaths(id, current.brand_id);
  if (values.brandId !== current.brand_id) revalidateIdeaPaths(id, values.brandId);
}

export async function updateIdeaStatusAction(formData: FormData): Promise<void> {
  await requireTeamSession();
  const id = String(formData.get("ideaId") ?? "").trim();
  const status = String(formData.get("status") ?? "");
  if (!isIdeaStatus(status)) throw new Error("Fikir durumu geçersiz.");
  const idea = getIdea(id);
  if (!idea) throw new Error("Fikir bulunamadı.");
  updateIdeaStatus(id, status);
  await recordActivity({
    action: "idea.status",
    entityType: "idea",
    entityId: id,
    brandId: idea.brand_id,
    summary: `“${idea.title}” fikrini ${IDEA_STATUS_LABEL[status].toLocaleLowerCase("tr-TR")} durumuna aldı`,
  });
  revalidateIdeaPaths(id, idea.brand_id);
}

export async function setIdeaArchivedAction(
  id: string,
  archived: boolean,
  formData: FormData,
): Promise<void> {
  await requireTeamSession();
  void formData;
  const idea = getIdea(id);
  if (!idea) throw new Error("Fikir bulunamadı.");
  setIdeaArchived(id, archived);
  await recordActivity({
    action: archived ? "idea.archive" : "idea.restore",
    entityType: "idea",
    entityId: id,
    brandId: idea.brand_id,
    summary: `“${idea.title}” fikrini ${archived ? "arşivledi" : "aktif bankaya geri aldı"}`,
  });
  revalidateIdeaPaths(id, idea.brand_id);
}

/**
 * Fikri KALICI siler. Yetki: yönetici tüm fikirleri, sahibi kendi fikrini.
 * Arşivleme AYRI bir işlem (setIdeaArchivedAction) — bu ikisi karıştırılmıyor.
 * Bağlı göreve dönüşmüş fikir bu sürümde silinmez, yalnızca arşivlenebilir.
 * Gerçek silme, arayüzdeki geri alma süresi dolmadan ÇAĞRILMIYOR
 * (lib/undoQueue.ts deseni) — burada ikinci bir gecikme yok.
 */
export async function deleteIdeaAction(id: string): Promise<ActionResult> {
  const actor = await requireTeamSession();
  return runAction("idea.delete", async () => {
    const idea = getIdea(id);
    if (!idea) throw new ExpectedActionError("Fikir bulunamadı.", "notFound");
    if (!canDeleteIdea(actor.person, idea)) {
      throw new ExpectedActionError("Bu fikri yalnızca sahibi veya bir yönetici silebilir.", "forbidden");
    }
    const result = deleteIdea(id, { id: actor.person.id, name: actor.person.name });
    if (!result.deleted && result.reason === "linked") {
      throw new ExpectedActionError(
        "Bu fikir bir göreve bağlandığı için silinemez; arşivleyebilirsin. Bağlı görev etkilenmez.",
      );
    }
    if (!result.deleted) throw new ExpectedActionError("Fikir bulunamadı.", "notFound");
    await recordActivity({
      action: "idea.delete",
      entityType: "idea",
      entityId: id,
      brandId: idea.brand_id,
      summary: `“${idea.title}” fikrini sildi`,
    });
    revalidateIdeaPaths(id, idea.brand_id);
    return { ok: true as const };
  });
}
