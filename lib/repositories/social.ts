import { getDb, plainList, plainOne } from "@/lib/db/client";
import { daysBetween } from "@/lib/socialSilence";
import type {
  BrandSocialRow,
  BrandSocialState,
  SocialSyncRun,
  SocialSyncStatus,
} from "@/lib/types";

const PLATFORM = "instagram";

export interface TrackedBrand {
  id: string;
  name: string;
  handle: string;
}

/** Taranacak markalar: arşivlenmemiş ve Instagram kullanıcı adı girilmiş olanlar. */
export function listTrackedBrands(): TrackedBrand[] {
  return plainList<TrackedBrand>(
    getDb()
      .prepare(
        `SELECT id, name, lower(trim(instagram_handle)) AS handle
           FROM brands
          WHERE archived = 0
            AND instagram_handle IS NOT NULL
            AND trim(instagram_handle) <> ''
          ORDER BY name`,
      )
      .all(),
  );
}

export interface IncomingPost {
  brandId: string;
  externalId: string;
  postedAt: string;
  permalink: string | null;
  mediaType: string | null;
  caption: string | null;
}

/**
 * Gönderileri yazar, DAHA ÖNCE görülenleri atlar ve gerçekten yeni olanların
 * sayısını döndürür. `INSERT OR IGNORE` + UNIQUE(brand_id, platform,
 * external_id): aynı gönderi her taramada tekrar geldiği için "kaç yeni
 * paylaşım" sayısı ancak böyle doğru çıkar. `brand_id` kısıta dahil çünkü bir
 * ortak gönderi (collab) iki markayı birden etiketleyebilir — her ikisi de
 * kendi satırını hak eder (bkz. lib/social/apify.ts'teki
 * `resolveHandlesForItem`, aynı external_id için birden çok handle üretebilir).
 */
export function insertPostsIfNew(posts: IncomingPost[]): number {
  if (posts.length === 0) return 0;
  const db = getDb();
  const statement = db.prepare(
    `INSERT OR IGNORE INTO social_posts
       (id, brand_id, platform, external_id, permalink, media_type, caption, posted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  let inserted = 0;
  db.exec("BEGIN");
  try {
    for (const post of posts) {
      const result = statement.run(
        crypto.randomUUID(),
        post.brandId,
        PLATFORM,
        post.externalId,
        post.permalink,
        post.mediaType,
        post.caption,
        post.postedAt,
      );
      inserted += Number(result.changes) > 0 ? 1 : 0;
    }
    db.exec("COMMIT");
  } catch (cause) {
    db.exec("ROLLBACK");
    throw cause;
  }
  return inserted;
}

/**
 * Marka durumunu günceller. `lastPostAt` DB'deki en yeni gönderiden okunur —
 * sağlayıcıdan gelen partiye değil: bir taramada eski gönderi dönerse elimizdeki
 * daha yeni tarih geri gitmesin.
 */
export function updateBrandSocialState(input: {
  brandId: string;
  handle: string;
  status: "ok" | "error";
  error: string | null;
  checkedAt: string;
}): void {
  getDb()
    .prepare(
      `INSERT INTO brand_social_state
         (brand_id, platform, handle, last_post_at, last_checked_at, last_status, last_error)
       VALUES (
         ?, ?, ?,
         (SELECT max(posted_at) FROM social_posts WHERE brand_id = ? AND platform = ?),
         ?, ?, ?
       )
       ON CONFLICT(brand_id, platform) DO UPDATE SET
         handle          = excluded.handle,
         last_post_at    = excluded.last_post_at,
         last_checked_at = excluded.last_checked_at,
         last_status     = excluded.last_status,
         last_error      = excluded.last_error`,
    )
    .run(
      input.brandId,
      PLATFORM,
      input.handle,
      input.brandId,
      PLATFORM,
      input.checkedAt,
      input.status,
      input.error,
    );
}

export function markSilenceAlerted(brandId: string, whenIso: string): void {
  getDb()
    .prepare(
      `UPDATE brand_social_state SET alerted_at = ? WHERE brand_id = ? AND platform = ?`,
    )
    .run(whenIso, brandId, PLATFORM);
}

export function getBrandSocialState(brandId: string): BrandSocialState | undefined {
  return plainOne<BrandSocialState>(
    getDb()
      .prepare(`SELECT * FROM brand_social_state WHERE brand_id = ? AND platform = ?`)
      .get(brandId, PLATFORM),
  );
}

/**
 * Ekranların okuduğu birleşik liste. Hiç taranmamış markalar da dönsün diye
 * `brands` sol taraf: durum satırı yoksa alanlar null kalır, arayüz bunu
 * "taranmadı" olarak gösterir.
 */
export function listBrandSocialRows(): BrandSocialRow[] {
  const rows = plainList<Omit<BrandSocialRow, "days_silent">>(
    getDb()
      .prepare(
        `SELECT
           b.id                AS brand_id,
           b.name              AS brand_name,
           b.logo_path         AS logo_path,
           coalesce(s.handle, lower(trim(b.instagram_handle))) AS handle,
           s.last_post_at      AS last_post_at,
           (SELECT p.permalink FROM social_posts p
             WHERE p.brand_id = b.id AND p.platform = 'instagram'
             ORDER BY p.posted_at DESC LIMIT 1) AS last_post_permalink,
           s.last_checked_at   AS last_checked_at,
           s.last_status       AS last_status,
           s.last_error        AS last_error,
           -- julianday ile karşılaştırılıyor, metin olarak DEĞİL: posted_at
           -- sağlayıcıdan ISO ('...T...Z') gelirken datetime('now') boşluklu
           -- biçim üretiyor; metin karşılaştırması gün sınırında yanılırdı.
           (SELECT count(*) FROM social_posts p
             WHERE p.brand_id = b.id AND p.platform = 'instagram'
               AND julianday(p.posted_at) >= julianday('now', '-30 days')) AS post_count_30d
         FROM brands b
         LEFT JOIN brand_social_state s
           ON s.brand_id = b.id AND s.platform = 'instagram'
         WHERE b.archived = 0
           AND b.instagram_handle IS NOT NULL
           AND trim(b.instagram_handle) <> ''
         ORDER BY
           CASE WHEN s.last_post_at IS NULL THEN 1 ELSE 0 END,
           s.last_post_at ASC,
           b.name`,
      )
      .all(),
  );

  // Gün sayısı SQL'de DEĞİL burada hesaplanıyor: sınıflandırmayı yapan
  // `classifySocial` de aynı `daysBetween`'i kullanıyor. SQL tarafında
  // julianday farkı (tam 24 saatlik dilimler) ile takvim günü farkı
  // ayrışabiliyordu — rozette "0 gün" yazarken sınıflandırmanın "1 gün"
  // saydığı durumlar çıkıyordu. Tek kaynak, tek cevap.
  const now = new Date().toISOString();
  return rows.map((row) => ({
    ...row,
    days_silent: row.last_post_at ? daysBetween(row.last_post_at, now) : null,
  }));
}

export function startSyncRun(provider: string): string {
  const id = crypto.randomUUID();
  getDb()
    .prepare(`INSERT INTO social_sync_runs (id, provider, status) VALUES (?, ?, 'running')`)
    .run(id, provider);
  return id;
}

export function finishSyncRun(input: {
  id: string;
  status: Exclude<SocialSyncStatus, "running">;
  accounts: number;
  newPosts: number;
  error: string | null;
}): void {
  getDb()
    .prepare(
      `UPDATE social_sync_runs
          SET status = ?, accounts = ?, new_posts = ?, error = ?, finished_at = datetime('now')
        WHERE id = ?`,
    )
    .run(input.status, input.accounts, input.newPosts, input.error, input.id);
}

/** En son tamamlanan tarama — ekranlarda "veri ne kadar taze" bilgisi için. */
export function getLatestSyncRun(): SocialSyncRun | undefined {
  return plainOne<SocialSyncRun>(
    getDb()
      .prepare(`SELECT * FROM social_sync_runs ORDER BY started_at DESC, rowid DESC LIMIT 1`)
      .get(),
  );
}

export function listRecentSyncRuns(limit = 10): SocialSyncRun[] {
  return plainList<SocialSyncRun>(
    getDb()
      .prepare(
        `SELECT * FROM social_sync_runs ORDER BY started_at DESC, rowid DESC LIMIT ?`,
      )
      .all(limit),
  );
}
