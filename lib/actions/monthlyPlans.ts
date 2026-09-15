"use server";

import { revalidatePath } from "next/cache";
import { recordActivity } from "@/lib/activity";
import { ExpectedActionError, runAction, runAfterCommit, type ActionResult } from "@/lib/actionResult";
import { requireManager } from "@/lib/identity";
import { CONTENT_TYPES } from "@/lib/constants";
import { catalogItem, isPointProfile, type PointProfile } from "@/lib/points/catalog";
import { isValidPlanMonth } from "@/lib/monthlyPlan";
import {
  createMonthlyPackage,
  deleteMonthlyTaskPlan,
  runMonthlyPlans,
  setMonthlyPlanPaused,
  upsertMonthlyTaskPlan,
  type PreviewRow,
} from "@/lib/repositories/monthlyPlans";
import { getBrand } from "@/lib/repositories/brands";
import type { ContentType } from "@/lib/types";

function text(formData: FormData, key: string, label: string, max = 200): string {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new ExpectedActionError(`${label} zorunlu.`);
  if (value.length > max) throw new ExpectedActionError(`${label} en fazla ${max} karakter olabilir.`);
  return value;
}

function planMonth(formData: FormData, key: string): string {
  const value = String(formData.get(key) ?? "").trim();
  if (!isValidPlanMonth(value)) throw new ExpectedActionError("Ay 'YYYY-AA' biçiminde olmalı.");
  return value;
}

function contentType(formData: FormData): ContentType {
  const value = String(formData.get("contentType") ?? "") as ContentType;
  if (!CONTENT_TYPES.includes(value)) throw new ExpectedActionError("Görev türü seçilmeli.");
  return value;
}

function profile(formData: FormData): PointProfile {
  const value = String(formData.get("profile") ?? "");
  if (!isPointProfile(value)) throw new ExpectedActionError("Puan profili seçilmeli.");
  return value;
}

/**
 * Önizlemedeki satırları kaydeder. Satırlar TEK TEK düzenlenebilir olduğu için
 * başlık/tarih/sorumlu formdan satır satır okunuyor; tarih önerileri yalnızca
 * başlangıç değeriydi.
 */
export async function createMonthlyPackageAction(formData: FormData): Promise<ActionResult<string>> {
  const actor = await requireManager();
  return runAction<string>("monthlyPlan.createPackage", async () => {
    const brandId = text(formData, "brandId", "Marka", 80);
    const brand = getBrand(brandId);
    if (!brand) throw new ExpectedActionError("Marka bulunamadı.", "notFound");
    const selectedProfile = profile(formData);
    const itemKey = text(formData, "itemKey", "Katalog kalemi", 80);
    const item = catalogItem(selectedProfile, itemKey);
    if (!item) throw new ExpectedActionError("Bu profilde böyle bir katalog kalemi yok.");
    const month = planMonth(formData, "planMonth");
    const personId = text(formData, "personId", "Hak sahibi", 80);

    const titles = formData.getAll("rowTitle").map(String);
    const dates = formData.getAll("rowDueDate").map(String);
    const assignees = formData.getAll("rowAssigneeId").map(String);
    const types = formData.getAll("rowContentType").map(String);
    if (titles.length === 0) throw new ExpectedActionError("Önizlemede hiç satır yok.");
    if (titles.length !== dates.length) throw new ExpectedActionError("Önizleme satırları eksik; sayfayı yenileyin.");

    const rows: PreviewRow[] = titles.map((title, index) => {
      const trimmed = title.trim();
      if (!trimmed) throw new ExpectedActionError(`${index + 1}. satırın başlığı boş olamaz.`);
      const dueDate = dates[index]?.trim() ?? "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        throw new ExpectedActionError(`${index + 1}. satırın teslim tarihi geçersiz.`);
      }
      const rowType = (types[index] ?? "") as ContentType;
      return {
        title: trimmed,
        dueDate,
        contentType: CONTENT_TYPES.includes(rowType) ? rowType : contentType(formData),
        assigneeId: assignees[index]?.trim() || personId,
      };
    });

    let result: { packageId: string; taskIds: string[] };
    try {
      result = createMonthlyPackage({
        brandId,
        profile: selectedProfile,
        itemKey,
        planMonth: month,
        personId,
        rows,
        createdBy: actor.person.id,
        planId: String(formData.get("planId") ?? "").trim() || null,
        source: "manual",
      });
    } catch (error) {
      throw new ExpectedActionError(error instanceof Error ? error.message : "Paket oluşturulamadı.");
    }

    await runAfterCommit("monthlyPlan.createPackage", () =>
      recordActivity({
        action: "points.package.bulk",
        entityType: "brand",
        entityId: brandId,
        brandId,
        summary: `${brand.name} için ${rows.length} işlik ${item.label} paketi oluşturdu (${month})`,
      }),
    );
    revalidatePath("/", "layout");
    return { ok: true as const, value: result.packageId, message: `${rows.length} iş ve puan paketi oluşturuldu.` };
  });
}

export async function saveMonthlyPlanAction(formData: FormData): Promise<ActionResult<string>> {
  const actor = await requireManager();
  return runAction<string>("monthlyPlan.save", async () => {
    const selectedProfile = profile(formData);
    const itemKey = text(formData, "itemKey", "Katalog kalemi", 80);
    const item = catalogItem(selectedProfile, itemKey);
    if (!item) throw new ExpectedActionError("Bu profilde böyle bir katalog kalemi yok.");
    const itemCount = Number(formData.get("itemCount") ?? item.requiredCount);
    if (!Number.isInteger(itemCount) || itemCount < item.requiredCount || itemCount > 60) {
      throw new ExpectedActionError(`Adet ${item.requiredCount} ile 60 arasında olmalı.`);
    }
    const generationDay = Number(formData.get("generationDay") ?? 1);
    if (!Number.isInteger(generationDay) || generationDay < 1 || generationDay > 28) {
      throw new ExpectedActionError("Üretim günü 1 ile 28 arasında olmalı.");
    }
    const id = upsertMonthlyTaskPlan({
      id: String(formData.get("planId") ?? "").trim() || undefined,
      label: text(formData, "label", "Plan adı"),
      brandId: text(formData, "brandId", "Marka", 80),
      profile: selectedProfile,
      itemKey,
      assigneeId: text(formData, "assigneeId", "Sorumlu", 80),
      contentType: contentType(formData),
      itemCount,
      titlePattern: text(formData, "titlePattern", "Başlık kalıbı"),
      startMonth: planMonth(formData, "startMonth"),
      generationDay,
      paused: formData.get("paused") === "1",
      createdBy: actor.person.id,
    });
    revalidatePath("/", "layout");
    return { ok: true as const, value: id, message: "Aylık plan kaydedildi." };
  });
}

export async function setMonthlyPlanPausedAction(planId: string, paused: boolean): Promise<ActionResult> {
  await requireManager();
  return runAction("monthlyPlan.pause", async () => {
    if (!setMonthlyPlanPaused(planId, paused)) {
      throw new ExpectedActionError("Plan bulunamadı.", "notFound");
    }
    revalidatePath("/", "layout");
    return { ok: true as const, message: paused ? "Plan duraklatıldı." : "Plan yeniden çalışıyor." };
  });
}

export async function deleteMonthlyPlanAction(planId: string): Promise<ActionResult> {
  await requireManager();
  return runAction("monthlyPlan.delete", async () => {
    deleteMonthlyTaskPlan(planId);
    revalidatePath("/", "layout");
    return { ok: true as const, message: "Plan silindi." };
  });
}

/**
 * Planları ELLE çalıştırır (kesinti sonrası bu ayın eksiğini tamamlamak için).
 * Gerçek zamanlayıcı yalnızca canlıda ve TEK sahiplikle etkinleştirilir;
 * bu düğme aynı ayı ikinci kez üretmez (plan + ay kimliği benzersiz).
 */
export async function runMonthlyPlansAction(): Promise<ActionResult> {
  const actor = await requireManager();
  return runAction("monthlyPlan.run", async () => {
    const outcomes = runMonthlyPlans({ actorId: actor.person.id });
    const created = outcomes.filter((outcome) => outcome.status === "ok").length;
    const failed = outcomes.filter((outcome) => outcome.status === "error");
    revalidatePath("/", "layout");
    if (failed.length > 0) {
      return {
        ok: true as const,
        message: `${created} paket üretildi · ${failed.length} plan hata verdi: ${failed[0].message}`,
      };
    }
    return { ok: true as const, message: `${created} paket üretildi.` };
  });
}
