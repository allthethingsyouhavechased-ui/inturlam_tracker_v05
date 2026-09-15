import { getDb, plainList } from "@/lib/db/client";
import { plannedTaskCondition } from "@/lib/taskPlanning";
import type { PersonActiveWork, TaskStatus } from "@/lib/types";

export interface PersonTaskWorkSummary {
  person_id: string;
  open_count: number;
  overdue_count: number;
  /** Açık + yayınlanmış (arşivlenmemiş) işlerin toplamı — kartın "Tümü" filtresi. */
  all_count: number;
  /** Arşivdeki işler; yalnızca isteğe bağlı olarak gösterilir. */
  archived_count: number;
}

export interface PersonTaskPreview {
  person_id: string;
  task_id: string;
  title: string;
  status: TaskStatus;
  brand_id: string;
  brand_name: string;
  brand_accent_hue: number;
  due_date: string | null;
  is_open: number;
}

/**
 * Kartta açılır listede gösterilen en fazla satır sayısı. Bunun ÜSTÜ "tüm
 * görevler" bağlantısına gider — kartta sonsuz liste büyütmüyoruz.
 */
export const PERSON_TASK_PREVIEW_LIMIT = 8;

export function listActiveWorkSelections(): PersonActiveWork[] {
  return plainList<PersonActiveWork>(
    getDb()
      .prepare(
        `SELECT paw.person_id, paw.brand_id, b.name AS brand_name, paw.updated_at
           FROM person_active_work paw
           JOIN people p ON p.id = paw.person_id AND p.active = 1
           JOIN brands b ON b.id = paw.brand_id AND b.archived = 0
          ORDER BY p.name`,
      )
      .all(),
  );
}

/**
 * Ekip ekranı yalnızca kişi başına yük özeti ister. Tam görev nesnelerini
 * istemciye göndermek yerine sayımları SQLite'ta yapar; aktif marka seçimi bu
 * sayıları daraltmaz, çünkü o seçim kişinin anlık odağıdır, toplam iş yükü değil.
 */
export function listPersonTaskWorkSummaries(
  today: string,
): PersonTaskWorkSummary[] {
  return plainList<PersonTaskWorkSummary>(
    getDb()
      .prepare(
        // LEFT JOIN artık arşivi ve yayınlananları da getiriyor; her sayaç
        // kendi koşulunu CASE ile uyguluyor. `t.id IS NOT NULL` şart:
        // görevi olmayan kişi için üretilen boş satır aksi hâlde 1 sayılırdı
        // (CLAUDE.md'deki "LEFT JOIN + tüm zamanlar" tuzağının aynısı).
        `SELECT p.id AS person_id,
                COALESCE(SUM(CASE WHEN t.id IS NOT NULL AND t.archived_at IS NULL AND t.status != 'Yayinlandi' THEN 1 ELSE 0 END), 0) AS open_count,
                COALESCE(SUM(
                  CASE WHEN t.id IS NOT NULL AND t.archived_at IS NULL AND t.status != 'Yayinlandi'
                        AND t.due_date IS NOT NULL AND t.due_date < ? THEN 1 ELSE 0 END
                ), 0) AS overdue_count,
                COALESCE(SUM(CASE WHEN t.id IS NOT NULL AND t.archived_at IS NULL THEN 1 ELSE 0 END), 0) AS all_count,
                COALESCE(SUM(CASE WHEN t.id IS NOT NULL AND t.archived_at IS NOT NULL THEN 1 ELSE 0 END), 0) AS archived_count
           FROM people p
           LEFT JOIN tasks t
             ON t.assignee_id = p.id
            AND ${plannedTaskCondition("t")}
          WHERE p.active = 1
          GROUP BY p.id
          ORDER BY p.name`,
      )
      .all(today),
  );
}

/**
 * Kişi başına görev önizlemesi. Kart varsayılan olarak AÇIK işleri gösteriyor,
 * "Tümü" filtresi yayınlananları da katıyor — bu yüzden sorgu iki sıralama
 * taşıyor: tüm satırlar arasındaki sıra (`rank_all`) ve yalnız açık satırlar
 * arasındaki sıra (`rank_open`). İkisinden biri sınırın altındaysa satır gelir,
 * böylece "Tümü"ye geçmek açık işleri listeden düşürmez.
 * Arşiv BİLEREK dışarıda: kart iş yükünü gösteriyor, arşiv ayrı ekranda.
 */
export function listPersonTaskPreviews(limit = PERSON_TASK_PREVIEW_LIMIT): PersonTaskPreview[] {
  return plainList<PersonTaskPreview>(
    getDb()
      .prepare(
        `WITH ranked_tasks AS (
           SELECT t.assignee_id AS person_id,
                  t.id AS task_id,
                  t.title,
                  t.status,
                  b.id AS brand_id,
                  b.name AS brand_name,
                  b.accent_hue AS brand_accent_hue,
                  t.due_date,
                  CASE WHEN t.status != 'Yayinlandi' THEN 1 ELSE 0 END AS is_open,
                  ROW_NUMBER() OVER (
                    PARTITION BY t.assignee_id
                    ORDER BY (t.status = 'Yayinlandi'), (t.due_date IS NULL), t.due_date,
                      CASE t.priority
                        WHEN 'Acil' THEN 0 WHEN 'Yuksek' THEN 1
                        WHEN 'Normal' THEN 2 ELSE 3
                      END,
                      t.created_at,
                      t.id
                  ) AS rank_all,
                  ROW_NUMBER() OVER (
                    PARTITION BY t.assignee_id, CASE WHEN t.status != 'Yayinlandi' THEN 1 ELSE 0 END
                    ORDER BY (t.due_date IS NULL), t.due_date,
                      CASE t.priority
                        WHEN 'Acil' THEN 0 WHEN 'Yuksek' THEN 1
                        WHEN 'Normal' THEN 2 ELSE 3
                      END,
                      t.created_at,
                      t.id
                  ) AS rank_in_scope
             FROM tasks t
             JOIN people p ON p.id = t.assignee_id AND p.active = 1
             JOIN content_items ci ON ci.id = t.content_item_id
             JOIN brands b ON b.id = ci.brand_id
            WHERE t.archived_at IS NULL
              AND ${plannedTaskCondition("t")}
         )
         SELECT person_id, task_id, title, status, brand_id, brand_name, brand_accent_hue, due_date, is_open
           FROM ranked_tasks
          WHERE rank_all <= ? OR (is_open = 1 AND rank_in_scope <= ?)
          ORDER BY person_id, rank_all`,
      )
      .all(limit, limit),
  );
}

export function setPersonActiveBrand(
  personId: string,
  brandId: string | null,
): void {
  const db = getDb();

  if (!brandId) {
    db.prepare("DELETE FROM person_active_work WHERE person_id = ?").run(personId);
    return;
  }

  const brand = db
    .prepare("SELECT 1 FROM brands WHERE id = ? AND archived = 0")
    .get(brandId);
  if (!brand) throw new Error("Seçilen marka bulunamadı veya arşivlenmiş.");

  db.prepare(
    `INSERT INTO person_active_work (person_id, brand_id, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(person_id) DO UPDATE SET
       brand_id = excluded.brand_id,
       updated_at = excluded.updated_at`,
  ).run(personId, brandId);
}
