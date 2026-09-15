"use server";

import { revalidatePath } from "next/cache";
import { recordActivity } from "@/lib/activity";
import { ExpectedActionError, runAction, runAfterCommit, type ActionResult } from "@/lib/actionResult";
import { requireManager } from "@/lib/identity";
import { assertPointMonth } from "@/lib/points/period";
import { parsePointInputToUnits } from "@/lib/points/units";
import {
  catalogItem,
  extraPointItem,
  isPointProfile,
  packageUnitsFor,
  type PointProfile,
} from "@/lib/points/catalog";
import {
  assignPersonPointProfile,
  currentCatalogVersion,
  personProfileForMonth,
} from "@/lib/repositories/pointCatalog";
import {
  createPointPackage,
  updatePointPackageMembers,
} from "@/lib/repositories/pointPackages";
import {
  recordExtraPoint,
  recordManagerPoint,
  reversePointEntry,
} from "@/lib/repositories/pointLedger";
import { getPerson } from "@/lib/repositories/people";

function required(formData: FormData, key: string, label: string): string {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new ExpectedActionError(`${label} zorunlu.`);
  return value;
}

function month(formData: FormData, key = "month"): string {
  try { return assertPointMonth(String(formData.get(key) ?? "").trim()); }
  catch { throw new ExpectedActionError("Dönem 'YYYY-AA' biçiminde olmalı."); }
}

/** Kişiye puan profili atar. Departmandan/isimden TAHMİN yapılmaz. */
export async function assignPointProfileAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireManager();
  return runAction("points.assignProfile", async () => {
    const personId = required(formData, "personId", "Kişi");
    const profile = String(formData.get("profile") ?? "");
    if (!isPointProfile(profile)) throw new ExpectedActionError("Geçerli bir puan profili seçin.");
    const effectiveFrom = `${month(formData, "effectiveFromMonth")}-01`;
    if (!getPerson(personId)) throw new ExpectedActionError("Kişi bulunamadı.", "notFound");
    assignPersonPointProfile({
      personId,
      profile: profile as PointProfile,
      effectiveFrom,
      assignedBy: actor.person.id,
    });
    revalidatePath("/", "layout");
    return { ok: true as const, message: "Puan profili atandı." };
  });
}

/**
 * Puan paketi açar. Paket SABİT bir üyelik listesiyle oluşur; adet katalogdan
 * gelir ve küçültülemez. Aynı kapsam için ikinci paket açılamaz.
 */
export async function createPointPackageAction(formData: FormData): Promise<ActionResult<string>> {
  const actor = await requireManager();
  return runAction<string>("points.createPackage", async () => {
    const profile = String(formData.get("profile") ?? "");
    if (!isPointProfile(profile)) throw new ExpectedActionError("Puan profili seçin.");
    const itemKey = required(formData, "itemKey", "Katalog kalemi");
    const item = catalogItem(profile as PointProfile, itemKey);
    if (!item) throw new ExpectedActionError("Bu profilde böyle bir katalog kalemi yok.");
    const personId = required(formData, "personId", "Hak sahibi");
    const planMonth = month(formData, "planMonth");
    const brandId = String(formData.get("brandId") ?? "").trim() || null;
    if (item.scope === "brand" && !brandId) {
      throw new ExpectedActionError("Bu kalem marka kapsamında; marka seçilmeli.");
    }
    const taskIds = formData.getAll("taskId").map(String).filter(Boolean);
    if (taskIds.length < item.requiredCount) {
      throw new ExpectedActionError(
        `Paket için ${item.requiredCount} iş seçilmeli; şu an ${taskIds.length} seçili.`,
      );
    }
    const version = currentCatalogVersion();
    if (!version) throw new ExpectedActionError("Puan kataloğu bulunamadı.");
    // Profil uyuşmazlığı sessizce geçmesin: hak sahibinin o aydaki profili
    // paketin profiliyle aynı olmalı.
    const assigned = personProfileForMonth(personId, planMonth);
    if (assigned && assigned !== profile) {
      throw new ExpectedActionError(
        `Bu kişinin ${planMonth} profili "${assigned}"; paket profiliyle uyuşmuyor.`,
      );
    }

    let packageId: string;
    try {
      packageId = createPointPackage({
        profile: profile as PointProfile,
        scope: item.scope,
        brandId: item.scope === "brand" ? brandId : null,
        personId,
        planMonth,
        itemKey,
        catalogVersionId: version.id,
        requiredCount: item.requiredCount,
        amountUnits: packageUnitsFor(item),
        taskIds,
        createdBy: actor.person.id,
      });
    } catch (error) {
      throw new ExpectedActionError(error instanceof Error ? error.message : "Paket oluşturulamadı.");
    }

    await runAfterCommit("points.createPackage", () =>
      recordActivity({
        action: "points.package.create",
        entityType: "task",
        entityId: packageId,
        brandId,
        summary: `${item.label} puan paketini açtı (${planMonth})`,
      }),
    );
    revalidatePath("/", "layout");
    return { ok: true as const, value: packageId, message: "Puan paketi açıldı." };
  });
}

/** Paket kapsamını değiştirir; gerekçe zorunlu, adet küçültülemez. */
export async function updatePointPackageMembersAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireManager();
  return runAction("points.updatePackage", async () => {
    const packageId = required(formData, "packageId", "Paket");
    const reason = required(formData, "reason", "Gerekçe");
    const taskIds = formData.getAll("taskId").map(String).filter(Boolean);
    try {
      updatePointPackageMembers({ packageId, taskIds, reason, actorId: actor.person.id });
    } catch (error) {
      throw new ExpectedActionError(error instanceof Error ? error.message : "Kapsam güncellenemedi.");
    }
    revalidatePath("/", "layout");
    return { ok: true as const, message: "Paket kapsamı güncellendi." };
  });
}

/** Ek puan havuzundan bir kalem yazar (çekim, toplantı, uygulanan fikir…). */
export async function recordExtraPointAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireManager();
  return runAction("points.recordExtra", async () => {
    const personId = required(formData, "personId", "Kişi");
    const itemKey = required(formData, "itemKey", "Kalem");
    const item = extraPointItem(itemKey);
    if (!item) throw new ExpectedActionError("Tanımsız ek puan kalemi.");
    if (item.units === null) {
      throw new ExpectedActionError("Yönetici görüşü serbest puan formundan girilir.");
    }
    const reason = String(formData.get("reason") ?? "").trim() || null;
    const occurredDate = String(formData.get("occurredOn") ?? "").trim();
    if (occurredDate && !/^\d{4}-\d{2}-\d{2}$/.test(occurredDate)) {
      throw new ExpectedActionError("Tarih geçersiz.");
    }
    // Referans: çekimde tarih zaten çapa; diğerlerinde teslim/olay kimliği.
    const referenceId = String(formData.get("referenceId") ?? "").trim()
      || occurredDate
      || crypto.randomUUID();
    try {
      recordExtraPoint({
        personId,
        itemKey,
        referenceId,
        // Yerel gün için öğle saati: gün sınırında saat dilimi kayması olmasın.
        occurredAt: occurredDate ? `${occurredDate}T09:00:00Z` : undefined,
        reason,
        createdBy: actor.person.id,
      });
    } catch (error) {
      throw new ExpectedActionError(error instanceof Error ? error.message : "Ek puan yazılamadı.");
    }
    revalidatePath("/", "layout");
    return { ok: true as const, message: `${item.label} puanı yazıldı.` };
  });
}

/** Yönetici serbest puanı — açıklama ZORUNLU, tutar 0,05 adımlı. */
export async function recordManagerPointAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireManager();
  return runAction("points.recordManager", async () => {
    const personId = required(formData, "personId", "Kişi");
    const period = month(formData, "period");
    const reason = required(formData, "reason", "Açıklama");
    let amountUnits: number;
    try { amountUnits = parsePointInputToUnits(String(formData.get("points") ?? "")); }
    catch (error) { throw new ExpectedActionError(error instanceof Error ? error.message : "Puan geçersiz."); }
    try {
      recordManagerPoint({ personId, period, amountUnits, reason, createdBy: actor.person.id });
    } catch (error) {
      throw new ExpectedActionError(error instanceof Error ? error.message : "Puan yazılamadı.");
    }
    revalidatePath("/", "layout");
    return { ok: true as const, message: "Yönetici puanı yazıldı." };
  });
}

/** Yanlış kaydı silmez; gerekçeli ters kayıt yazar. */
export async function reversePointEntryAction(formData: FormData): Promise<ActionResult> {
  const actor = await requireManager();
  return runAction("points.reverse", async () => {
    const entryId = required(formData, "entryId", "Kayıt");
    const reason = required(formData, "reason", "Gerekçe");
    try {
      reversePointEntry({ entryId, reason, createdBy: actor.person.id });
    } catch (error) {
      throw new ExpectedActionError(error instanceof Error ? error.message : "Ters kayıt yazılamadı.");
    }
    revalidatePath("/", "layout");
    return { ok: true as const, message: "Düzeltme kaydı yazıldı." };
  });
}
