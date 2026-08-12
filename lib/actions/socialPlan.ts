"use server";

import { revalidatePath } from "next/cache";
import { recordActivity } from "@/lib/activity";
import { requireSession } from "@/lib/identity";
import { getBrand } from "@/lib/repositories/brands";
import {
  setBrandAssetCount,
  setBrandContentTarget,
  setBrandMonthlyContentCompletion,
  setBrandPlanEntry,
} from "@/lib/repositories/socialPlan";
import {
  CONTENT_KIND_LABEL,
  clampCount,
  isContentKind,
  isPlanCombo,
  isValidPlanMonth,
  isValidPlanDate,
} from "@/lib/socialPlan";
import type { ContentKind } from "@/lib/types";

// Aylık hedef — nadir değişir, kim ne zaman değiştirdi bilinsin diye
// loglanıyor (brand.target). Varlık ±'sı ve takvim hücresi BİLEREK
// loglanmıyor: ayda yüzlerce tık üretirler, /activity ve marka akışını
// boğardı (bkz. plan).
export async function setBrandContentTargetAction(
  brandId: string,
  kind: ContentKind,
  value: number,
): Promise<void> {
  await requireSession();
  if (!isContentKind(kind)) throw new Error("Geçersiz içerik türü.");
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Marka bulunamadı.");

  const clamped = clampCount(value);
  setBrandContentTarget(brandId, kind, clamped);

  await recordActivity({
    action: "brand.target",
    entityType: "brand",
    entityId: brandId,
    brandId,
    summary: `“${brand.name}” markasının aylık ${CONTENT_KIND_LABEL[kind]} hedefini ${clamped} yaptı`,
  });

  revalidatePath("/", "layout");
}

export async function setBrandAssetCountAction(
  brandId: string,
  kind: ContentKind,
  value: number,
): Promise<void> {
  await requireSession();
  if (!isContentKind(kind)) throw new Error("Geçersiz içerik türü.");
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Marka bulunamadı.");

  setBrandAssetCount(brandId, kind, clampCount(value));
  revalidatePath("/", "layout");
}

export async function setBrandMonthlyContentCompletionAction(
  brandId: string,
  month: string,
  completed: boolean,
): Promise<void> {
  const actor = await requireSession();
  if (!isValidPlanMonth(month)) throw new Error("Geçersiz ay.");
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Marka bulunamadı.");

  setBrandMonthlyContentCompletion({ brandId, month, completed, actorId: actor.id });
  await recordActivity({
    action: completed ? "brand.monthly_content.completed" : "brand.monthly_content.reopened",
    entityType: "brand",
    entityId: brandId,
    brandId,
    summary: `“${brand.name}” markasının ${month} içerik teslimini ${completed ? "tamamlandı olarak işaretledi" : "yeniden açtı"}`,
  });

  revalidatePath(`/brands/${brandId}`);
  revalidatePath("/social/varlik");
}

export async function setBrandPlanEntryAction(
  brandId: string,
  planDate: string,
  combo: string | null,
): Promise<void> {
  await requireSession();
  if (!isValidPlanDate(planDate)) throw new Error("Geçersiz tarih.");
  if (combo !== null && !isPlanCombo(combo)) throw new Error("Geçersiz paylaşım türü.");
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Marka bulunamadı.");

  setBrandPlanEntry(brandId, planDate, combo);
  revalidatePath("/", "layout");
}
