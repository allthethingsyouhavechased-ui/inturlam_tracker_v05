import { getDb, plainList, plainOne } from "@/lib/db/client";
import { emptyKindRecord } from "@/lib/socialPlan";
import type {
  Brand,
  BrandAssetCount,
  BrandContentTarget,
  BrandMonthlyContentCompletion,
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

/**
 * Canlı stok sayacını yazar ve DEĞİŞTİYSE geçmişe bir satır ekler
 * (eski/yeni miktar, kim, ne zaman). Aynı değeri tekrar kaydetmek geçmişe
 * satır yazmaz — "değişiklik geçmişi" gürültüyle dolmasın.
 */
export function setBrandAssetCount(
  brandId: string,
  kind: ContentKind,
  readyCount: number,
  actorId: string | null = null,
): void {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const current = db
      .prepare("SELECT ready_count FROM brand_asset_counts WHERE brand_id = ? AND kind = ?")
      .get(brandId, kind) as { ready_count: number } | undefined;
    db.prepare(
      `INSERT INTO brand_asset_counts (brand_id, kind, ready_count)
       VALUES (?, ?, ?)
       ON CONFLICT(brand_id, kind) DO UPDATE SET
         ready_count = excluded.ready_count,
         updated_at = datetime('now')`,
    ).run(brandId, kind, readyCount);
    if (current?.ready_count !== readyCount) {
      db.prepare(
        `INSERT INTO brand_asset_count_changes
           (brand_id, kind, previous_count, ready_count, actor_id)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(brandId, kind, current?.ready_count ?? null, readyCount, actorId);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export interface BrandAssetCountChange {
  id: number;
  brand_id: string;
  kind: string;
  previous_count: number | null;
  ready_count: number;
  actor_id: string | null;
  actor_name: string | null;
  created_at: string;
}

export function listBrandAssetCountChanges(brandId?: string, limit = 50): BrandAssetCountChange[] {
  const db = getDb();
  const sql = `SELECT c.*, p.name AS actor_name
                 FROM brand_asset_count_changes c
                 LEFT JOIN people p ON p.id = c.actor_id
                ${brandId ? "WHERE c.brand_id = ?" : ""}
                ORDER BY c.id DESC LIMIT ?`;
  return plainList<BrandAssetCountChange>(
    brandId ? db.prepare(sql).all(brandId, limit) : db.prepare(sql).all(limit),
  );
}

/** Son stok güncellemesi damgası — rapordaki "son güncelleme" sütunu. */
export function lastAssetUpdateByBrand(): Map<string, string> {
  const rows = plainList<{ brand_id: string; updated_at: string }>(
    getDb()
      .prepare(
        `SELECT brand_id, MAX(updated_at) AS updated_at FROM brand_asset_counts GROUP BY brand_id`,
      )
      .all(),
  );
  return new Map(rows.map((row) => [row.brand_id, row.updated_at]));
}

// ————— Aylık teslim kapanışı (canlı stoktan bağımsız) —————

export function getBrandMonthlyContentCompletion(
  brandId: string,
  month: string,
): BrandMonthlyContentCompletion | undefined {
  return plainOne<BrandMonthlyContentCompletion>(
    getDb()
      .prepare(`SELECT * FROM brand_monthly_content_completions WHERE brand_id = ? AND month = ?`)
      .get(brandId, month),
  );
}

export function setBrandMonthlyContentCompletion(input: {
  brandId: string;
  month: string;
  completed: boolean;
  actorId: string | null;
}): void {
  const db = getDb();
  if (!input.completed) {
    db.prepare(`DELETE FROM brand_monthly_content_completions WHERE brand_id = ? AND month = ?`)
      .run(input.brandId, input.month);
    return;
  }
  db.prepare(
    `INSERT INTO brand_monthly_content_completions (brand_id, month, completed_by)
     VALUES (?, ?, ?)
     ON CONFLICT(brand_id, month) DO UPDATE SET
       completed_by = excluded.completed_by,
       completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
  ).run(input.brandId, input.month, input.actorId);
}

// Varlık sayfasının okuduğu birleşik satır — aktif her marka için (hedefi/
// sayacı hiç girilmemiş olsa bile) bir satır üretir. Portföy küçük (~19
// marka) olduğu için üç ayrı sorgunun sonucu SQL'de değil burada, JS'te
// birleştiriliyor — tek bir karmaşık JOIN yazmaktan daha okunur.
export function listBrandVarlikRows(month: string): BrandVarlikRow[] {
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

  const completions = new Map(
    plainList<Pick<BrandMonthlyContentCompletion, "brand_id" | "completed_at">>(
      db.prepare(
        `SELECT brand_id, completed_at FROM brand_monthly_content_completions WHERE month = ?`,
      ).all(month),
    ).map((row) => [row.brand_id, row.completed_at]),
  );

  return brands.map((brand) => ({
    brand_id: brand.id,
    brand_name: brand.name,
    logo_path: brand.logo_path,
    targets: targetsByBrand.get(brand.id) ?? emptyKindRecord(),
    ready: readyByBrand.get(brand.id) ?? emptyKindRecord(),
    monthly_content_completed: completions.has(brand.id),
    monthly_content_completed_at: completions.get(brand.id) ?? null,
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
