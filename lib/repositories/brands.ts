import { getDb, plainList, plainOne } from "@/lib/db/client";
import { chooseBrandAccentHue } from "@/lib/brandAccent";
import type { Brand, BrandWithCount, Cluster } from "@/lib/types";
import { plannedTaskCondition } from "@/lib/taskPlanning";

export function listBrands(): Brand[] {
  return plainList<Brand>(
    getDb()
      .prepare("SELECT * FROM brands WHERE archived = 0 ORDER BY sort_order, name")
      .all(),
  );
}

export function listArchivedBrands(): Brand[] {
  return plainList<Brand>(
    getDb()
      .prepare("SELECT * FROM brands WHERE archived = 1 ORDER BY name")
      .all(),
  );
}

export function createBrand(input: {
  name: string;
  cluster: Cluster;
  instagramHandle: string | null;
  logoPath?: string | null;
}): string {
  const id = crypto.randomUUID();
  const db = getDb();
  const { maxOrder } = plainOne<{ maxOrder: number | null }>(
    db.prepare("SELECT MAX(sort_order) AS maxOrder FROM brands").get(),
  )!;
  const usedHues = plainList<{ accent_hue: number }>(
    db.prepare("SELECT accent_hue FROM brands").all(),
  ).map((row) => row.accent_hue);
  const accentHue = chooseBrandAccentHue(usedHues);
  db
    .prepare(
      "INSERT INTO brands (id, name, cluster, sort_order, accent_hue, instagram_handle, logo_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(id, input.name, input.cluster, (maxOrder ?? 0) + 10, accentHue, input.instagramHandle, input.logoPath ?? null);
  return id;
}

// `median_reel_views`, `cover_test_*` ve `first_action` bilinçli olarak burada
// YOK: arayüzden kaldırıldılar. Sütunlar tabloda duruyor (eski araştırma verisi
// silinmesin) ama artık yazılmıyor.
//
// `stats_updated_at`: takipçi/gönderi sayılarından biri gerçekten DEĞİŞTİYSE
// bugüne çekilir. Kullanıcı yalnızca marka adını düzeltip kaydettiğinde damga
// tazelenmemeli — yoksa "bu hafta güncellendi" bilgisi yalan söyler.
export function updateBrand(input: {
  id: string;
  name: string;
  cluster: Cluster;
  instagramHandle: string | null;
  followerCount: number | null;
  postCount: number | null;
  keyFinding: string | null;
  tier: string | null;
  monthlyShootAllowance: number | null;
  annualShootAllowance: number | null;
  today: string;
  logoPath?: string;
}): void {
  const db = getDb();
  const current = plainOne<Pick<Brand, "follower_count" | "post_count" | "stats_updated_at">>(
    db
      .prepare(
        "SELECT follower_count, post_count, stats_updated_at FROM brands WHERE id = ?",
      )
      .get(input.id),
  );
  const statsChanged =
    current?.follower_count !== input.followerCount ||
    current?.post_count !== input.postCount;
  const statsUpdatedAt = statsChanged
    ? input.today
    : (current?.stats_updated_at ?? null);

  db.prepare(
    `UPDATE brands SET
       name = ?, cluster = ?, instagram_handle = ?,
       follower_count = ?, post_count = ?,
       key_finding = ?, tier = ?, stats_updated_at = ?, monthly_shoot_allowance = ?, annual_shoot_allowance = ?,
       logo_path = COALESCE(?, logo_path)
     WHERE id = ?`,
  ).run(
    input.name,
    input.cluster,
    input.instagramHandle,
    input.followerCount,
    input.postCount,
    input.keyFinding,
    input.tier,
    statsUpdatedAt,
    input.monthlyShootAllowance,
    input.annualShootAllowance,
    input.logoPath ?? null,
    input.id,
  );
}

export function deleteBrand(id: string): boolean {
  return Number(getDb().prepare("DELETE FROM brands WHERE id = ?").run(id).changes) === 1;
}

export function setBrandArchived(id: string, archived: boolean): boolean {
  const value = archived ? 1 : 0;
  const result = getDb()
    .prepare("UPDATE brands SET archived = ? WHERE id = ?")
    .run(value, id);
  return Number(result.changes) === 1;
}

export function listBrandsWithOpenCounts(): BrandWithCount[] {
  return plainList<BrandWithCount>(
    getDb()
      .prepare(
        `SELECT b.*, COUNT(t.id) AS open_count
         FROM brands b
         LEFT JOIN content_items ci ON ci.brand_id = b.id
         LEFT JOIN tasks t ON t.content_item_id = ci.id AND t.status != 'Yayinlandi'
          AND t.archived_at IS NULL
          AND ${plannedTaskCondition("t")}
         WHERE b.archived = 0
         GROUP BY b.id
         ORDER BY b.sort_order, b.name`,
      )
      .all(),
  );
}

export function getBrand(id: string): Brand | undefined {
  return plainOne<Brand>(
    getDb().prepare("SELECT * FROM brands WHERE id = ?").get(id),
  );
}

// NOT: `brand_relations` ve `brand_audits` tabloları hâlâ dolu (db/seed.mts
// vault'tan yazıyor) ama okunmuyorlar — "ilgili markalar" ve "tam denetim
// raporu" bölümleri arayüzden kaldırıldı, geri gelmeyecek. Okuma fonksiyonları
// ölü kod olmasın diye silindi; veriyi gerektiğinde SQL'le almak mümkün.
