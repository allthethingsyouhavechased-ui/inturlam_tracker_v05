import { getDb, plainList } from "@/lib/db/client";
import { emptyKindRecord } from "@/lib/socialPlan";
import type {
  Brand,
  BrandAssetCount,
  BrandContentTarget,
  BrandPlanEntry,
  BrandVarlikRow,
  ContentKind,
} from "@/lib/types";

// ————— Hedefler (brand_content_targets) —————

export function listBrandContentTargets(): BrandContentTarget[] {
  return plainList<BrandContentTarget>(
    getDb().prepare(`SELECT * FROM brand_content_targets`).all(),
  );
}

export function listContentTargetsForBrand(brandId: string): BrandContentTarget[] {
  return plainList<BrandContentTarget>(
    getDb()
      .prepare(`SELECT * FROM brand_content_targets WHERE brand_id = ?`)
      .all(brandId),
  );
}

export function setBrandContentTarget(
  brandId: string,
  kind: ContentKind,
  monthlyTarget: number,
): void {
  getDb()
    .prepare(
      `INSERT INTO brand_content_targets (brand_id, kind, monthly_target)
       VALUES (?, ?, ?)
       ON CONFLICT(brand_id, kind) DO UPDATE SET
         monthly_target = excluded.monthly_target,
         updated_at = datetime('now')`,
    )
    .run(brandId, kind, monthlyTarget);
}

// ————— Varlık (brand_asset_counts) —————

export function listBrandAssetCounts(): BrandAssetCount[] {
  return plainList<BrandAssetCount>(
    getDb().prepare(`SELECT * FROM brand_asset_counts`).all(),
  );
}

export function setBrandAssetCount(
  brandId: string,
  kind: ContentKind,
  readyCount: number,
): void {
  getDb()
    .prepare(
      `INSERT INTO brand_asset_counts (brand_id, kind, ready_count)
       VALUES (?, ?, ?)
       ON CONFLICT(brand_id, kind) DO UPDATE SET
         ready_count = excluded.ready_count,
         updated_at = datetime('now')`,
    )
    .run(brandId, kind, readyCount);
}

// Varlık sayfasının okuduğu birleşik satır — aktif her marka için (hedefi/
// sayacı hiç girilmemiş olsa bile) bir satır üretir. Portföy küçük (~19
// marka) olduğu için üç ayrı sorgunun sonucu SQL'de değil burada, JS'te
// birleştiriliyor — tek bir karmaşık JOIN yazmaktan daha okunur.
export function listBrandVarlikRows(): BrandVarlikRow[] {
  const db = getDb();
  const brands = plainList<Pick<Brand, "id" | "name" | "logo_path">>(
    db
      .prepare(
        `SELECT id, name, logo_path FROM brands WHERE archived = 0 ORDER BY sort_order, name`,
      )
      .all(),
  );

  const targetsByBrand = new Map<string, Record<ContentKind, number>>();
  for (const row of listBrandContentTargets()) {
    if (!targetsByBrand.has(row.brand_id)) targetsByBrand.set(row.brand_id, emptyKindRecord());
    const kind = row.kind as ContentKind;
    targetsByBrand.get(row.brand_id)![kind] = row.monthly_target;
  }

  const readyByBrand = new Map<string, Record<ContentKind, number>>();
  for (const row of listBrandAssetCounts()) {
    if (!readyByBrand.has(row.brand_id)) readyByBrand.set(row.brand_id, emptyKindRecord());
    const kind = row.kind as ContentKind;
    readyByBrand.get(row.brand_id)![kind] = row.ready_count;
  }

  return brands.map((brand) => ({
    brand_id: brand.id,
    brand_name: brand.name,
    logo_path: brand.logo_path,
    targets: targetsByBrand.get(brand.id) ?? emptyKindRecord(),
    ready: readyByBrand.get(brand.id) ?? emptyKindRecord(),
  }));
}

// ————— Paylaşım takvimi (brand_plan_entries) —————

// Aralık İKİ UÇTA da dahil — takvim sayfası ayın haftalarının ilk/son
// gününü (monthWeeks) doğrudan buraya verir.
export function listPlanEntriesInRange(startDate: string, endDate: string): BrandPlanEntry[] {
  return plainList<BrandPlanEntry>(
    getDb()
      .prepare(
        `SELECT * FROM brand_plan_entries
          WHERE plan_date >= ? AND plan_date <= ?
          ORDER BY plan_date`,
      )
      .all(startDate, endDate),
  );
}

// `combo` null ise satırı SİLER (boş seçim = "planlanan yok"), yoksa upsert
// eder. Boş bir kombinasyonu tabloda `combo = ''` olarak tutmuyoruz — hem
// gereksiz satır birikir hem sayım fonksiyonları (isPlanCombo) her zaman
// atlar, kafa karıştırıcı olur.
export function setBrandPlanEntry(
  brandId: string,
  planDate: string,
  combo: string | null,
): void {
  const db = getDb();
  if (combo === null) {
    db.prepare(`DELETE FROM brand_plan_entries WHERE brand_id = ? AND plan_date = ?`).run(
      brandId,
      planDate,
    );
    return;
  }
  db.prepare(
    `INSERT INTO brand_plan_entries (brand_id, plan_date, combo)
     VALUES (?, ?, ?)
     ON CONFLICT(brand_id, plan_date) DO UPDATE SET
       combo = excluded.combo,
       updated_at = datetime('now')`,
  ).run(brandId, planDate, combo);
}
