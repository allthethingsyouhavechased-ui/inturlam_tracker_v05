"use server";

import { revalidatePath } from "next/cache";
import { recordActivity } from "@/lib/activity";
import { resolveClusterFromForm } from "@/lib/clusters";
import { todayISO } from "@/lib/date";
import { requireManager } from "@/lib/identity";
import {
  createBrand,
  deleteBrand,
  getBrand,
  getBrandShootUsage,
  setBrandArchived,
  setBrandShootUsage,
  updateBrand,
} from "@/lib/repositories/brands";
import {
  listBrandPersonAssignments,
  replaceBrandPersonAssignments,
} from "@/lib/repositories/brandAssignments";
import { deleteUploadedFile, deleteUploadedFiles, replaceBrandLogo } from "@/lib/uploads";
import { listUploadPathsForBrand } from "@/lib/repositories/uploadReferences";

function extractLogoFile(formData: FormData): File | null {
  const value = formData.get("logo");
  return value instanceof File && value.size > 0 ? value : null;
}

function cleanValue(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length > 0 ? s : null;
}

// Takipçi/gönderi gibi sayılar Türkçe binlik ayracıyla ("12.345") girilebilir —
// rakam dışındaki her şeyi at, boşsa null.
function cleanInt(value: FormDataEntryValue | null): number | null {
  const digits = String(value ?? "").replace(/[^\d]/g, "");
  if (!digits) return null;
  const n = Number.parseInt(digits, 10);
  return Number.isFinite(n) ? n : null;
}

function cleanNonNegativeInt(value: FormDataEntryValue | null, label: string): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (!/^\d+$/.test(text)) throw new Error(`${label} sıfır veya pozitif tam sayı olmalı.`);
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed)) throw new Error(`${label} geçersiz.`);
  return parsed;
}

// Dönem gizli form alanından geliyor; biçimi doğrulanmazsa kullanıcı başka bir
// dönemin (ya da hiç var olmayan bir dönemin) sayacını yazabilirdi.
function cleanPeriod(value: FormDataEntryValue | null, pattern: RegExp): string | null {
  const text = String(value ?? "").trim();
  return pattern.test(text) ? text : null;
}

function sameIds(left: string[], right: string[]): boolean {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export async function createBrandAction(formData: FormData) {
  await requireManager();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Marka adı zorunlu.");
  if (name.length > 120) throw new Error("Marka adı en fazla 120 karakter olabilir.");
  const cluster = await resolveClusterFromForm(formData);

  const logo = extractLogoFile(formData);
  const create = (logoPath?: string) => createBrand({
    name,
    cluster,
    instagramHandle: cleanValue(formData.get("instagramHandle")),
    logoPath,
  });
  const id = logo
    ? await replaceBrandLogo(logo, null, (logoPath) => create(logoPath))
    : create();

  await recordActivity({
    action: "brand.create",
    entityType: "brand",
    entityId: id,
    brandId: id,
    summary: `“${name}” markasını oluşturdu`,
  });

  revalidatePath("/", "layout");
}

export async function updateBrandAction(formData: FormData) {
  const actor = await requireManager();
  const id = String(formData.get("brandId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!id) throw new Error("Marka bulunamadı.");
  if (!name) throw new Error("Marka adı zorunlu.");
  if (name.length > 120) throw new Error("Marka adı en fazla 120 karakter olabilir.");
  const current = getBrand(id);
  if (!current) throw new Error("Marka bulunamadı.");
  const keyFinding = cleanValue(formData.get("keyFinding"));
  if ((keyFinding?.length ?? 0) > 1000) throw new Error("Marka özeti en fazla 1000 karakter olabilir.");
  const cluster = await resolveClusterFromForm(formData);
  const instagramHandle = cleanValue(formData.get("instagramHandle"));
  const followerCount = cleanInt(formData.get("followerCount"));
  const postCount = cleanInt(formData.get("postCount"));
  const tier = cleanValue(formData.get("tier"));
  const monthlyShootAllowance = cleanNonNegativeInt(
    formData.get("monthlyShootAllowance"),
    "Aylık çekim hakkı",
  );
  const annualShootAllowance = cleanNonNegativeInt(
    formData.get("annualShootAllowance"),
    "Yıllık çekim hakkı",
  );
  // Kullanılan çekim sayısı markaya değil DÖNEME yazılır (aylık kota her ay
  // sıfırlanır). Dönem alanları yoksa sayaçlara hiç dokunulmaz.
  const usageMonth = cleanPeriod(formData.get("shootUsageMonth"), /^\d{4}-\d{2}$/);
  const usageYear = cleanPeriod(formData.get("shootUsageYear"), /^\d{4}$/);
  const monthlyShootUsed = usageMonth
    ? cleanNonNegativeInt(formData.get("monthlyShootUsed"), "Kullanılan aylık çekim")
    : null;
  const annualShootUsed = usageYear
    ? cleanNonNegativeInt(formData.get("annualShootUsed"), "Kullanılan yıllık çekim")
    : null;
  const monthlyUsageChanged = usageMonth !== null
    && getBrandShootUsage(id, usageMonth) !== monthlyShootUsed;
  const annualUsageChanged = usageYear !== null
    && getBrandShootUsage(id, usageYear) !== annualShootUsed;

  const responsibilitySelectionPresent = formData.get("responsibilitySelectionPresent") === "1";
  const responsiblePersonIds = formData.getAll("responsiblePersonId").map(String).filter(Boolean);
  const currentResponsiblePersonIds = listBrandPersonAssignments(id).map((item) => item.person_id);

  const update = (logoPath?: string) => updateBrand({
    id,
    name,
    cluster,
    instagramHandle,
    followerCount,
    postCount,
    keyFinding,
    tier,
    monthlyShootAllowance,
    annualShootAllowance,
    today: todayISO(),
    logoPath,
  });

  const logo = extractLogoFile(formData);
  const brandChanged =
    logo !== null ||
    current.name !== name ||
    current.cluster !== cluster ||
    current.instagram_handle !== instagramHandle ||
    current.follower_count !== followerCount ||
    current.post_count !== postCount ||
    current.key_finding !== keyFinding ||
    current.tier !== tier ||
    current.monthly_shoot_allowance !== monthlyShootAllowance ||
    current.annual_shoot_allowance !== annualShootAllowance;
  const assignmentsChanged = responsibilitySelectionPresent
    && !sameIds(responsiblePersonIds, currentResponsiblePersonIds);
  const usageChanged = monthlyUsageChanged || annualUsageChanged;
  if (!brandChanged && !assignmentsChanged && !usageChanged) return;
  if (brandChanged) {
    if (logo) {
      await replaceBrandLogo(logo, current.logo_path, (logoPath) => update(logoPath));
    } else update();
  }
  if (monthlyUsageChanged && usageMonth) setBrandShootUsage(id, usageMonth, monthlyShootUsed);
  if (annualUsageChanged && usageYear) setBrandShootUsage(id, usageYear, annualShootUsed);
  if (assignmentsChanged) {
    replaceBrandPersonAssignments(id, responsiblePersonIds, actor.person.id);
  }

  await recordActivity({
    action: "brand.update",
    entityType: "brand",
    entityId: id,
    brandId: id,
    summary: assignmentsChanged && !brandChanged && !usageChanged
      ? `“${name}” marka sorumlularını güncelledi`
      : assignmentsChanged
        ? `“${name}” marka bilgilerini ve sorumlularını güncelledi`
        : `“${name}” marka bilgilerini güncelledi`,
  });

  revalidatePath("/", "layout");
  revalidatePath("/panom");
  revalidatePath("/panom/markalar");
  revalidatePath("/team/manage");
  revalidatePath(`/brands/${id}`);
}

export async function archiveBrandAction(brandId: string) {
  await requireManager();
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Marka bulunamadı.");
  if (brand.archived === 1 || !setBrandArchived(brandId, true)) return;
  await recordActivity({
    action: "brand.archive",
    entityType: "brand",
    entityId: brandId,
    brandId,
    summary: `“${brand.name}” markasını arşivledi`,
  });
  revalidatePath("/", "layout");
}

// Kalıcı silme yalnızca arşivdeki bir markaya izin verir — aktif bir markayı
// tek tıkla, altındaki tüm içerik/görev/yorum geçmişiyle birlikte kalıcı
// olarak kaybetmeyi zorlaştıran bilinçli bir güvenlik adımı (bkz. arşivle
// önce deseni, DeleteBrandButton yalnızca arşiv listesinde gösteriliyor).
export async function deleteBrandAction(brandId: string) {
  await requireManager();
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Marka bulunamadı.");
  if (brand.archived !== 1) {
    throw new Error("Önce markayı arşivle, sonra sil.");
  }
  const uploadPaths = listUploadPathsForBrand(brandId);
  if (!deleteBrand(brandId)) throw new Error("Marka bulunamadı.");
  await deleteUploadedFiles(uploadPaths);
  if (brand.logo_path) {
    await deleteUploadedFile(brand.logo_path);
  }
  await recordActivity({
    action: "brand.delete",
    entityType: "brand",
    entityId: null,
    brandId: null,
    summary: `“${brand.name}” markasını kalıcı olarak sildi`,
  });
  revalidatePath("/", "layout");
}

export async function unarchiveBrandAction(brandId: string) {
  await requireManager();
  const brand = getBrand(brandId);
  if (!brand) throw new Error("Marka bulunamadı.");
  if (brand.archived !== 1 || !setBrandArchived(brandId, false)) return;
  await recordActivity({
    action: "brand.unarchive",
    entityType: "brand",
    entityId: brandId,
    brandId,
    summary: `“${brand.name}” markasını arşivden çıkardı`,
  });
  revalidatePath("/", "layout");
}
