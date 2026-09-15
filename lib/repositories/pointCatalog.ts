import { getDb, plainList, plainOne } from "@/lib/db/client";
import {
  isPointProfile,
  type PointProfile,
  type PointScope,
} from "@/lib/points/catalog";

export interface PointCatalogVersionRow {
  id: string;
  label: string;
  effective_from: string;
  note: string | null;
  created_at: string;
}

export interface PointCatalogItemRow {
  catalog_version_id: string;
  profile: PointProfile;
  item_key: string;
  label: string;
  scope: PointScope;
  required_count: number;
  unit_units: number;
  sort_order: number;
}

export function currentCatalogVersion(): PointCatalogVersionRow | undefined {
  return plainOne<PointCatalogVersionRow>(
    getDb()
      .prepare(
        `SELECT id, label, effective_from, note, created_at
           FROM point_catalog_versions
          ORDER BY effective_from DESC, created_at DESC LIMIT 1`,
      )
      .get(),
  );
}

export function listCatalogItems(versionId: string): PointCatalogItemRow[] {
  return plainList<PointCatalogItemRow>(
    getDb()
      .prepare(
        `SELECT * FROM point_catalog_items WHERE catalog_version_id = ?
          ORDER BY sort_order, item_key`,
      )
      .all(versionId),
  );
}

export function getCatalogItem(
  versionId: string,
  profile: PointProfile,
  itemKey: string,
): PointCatalogItemRow | undefined {
  return plainOne<PointCatalogItemRow>(
    getDb()
      .prepare(
        `SELECT * FROM point_catalog_items
          WHERE catalog_version_id = ? AND profile = ? AND item_key = ?`,
      )
      .get(versionId, profile, itemKey),
  );
}

// ————— Kişi ↔ profil eşlemesi —————

export interface PersonPointProfileRow {
  person_id: string;
  profile: PointProfile;
  effective_from: string;
  effective_to: string | null;
}

/**
 * Bir kişinin VERİLEN AY için geçerli profili. Departmandan ya da isimden
 * tahmin YAPILMAZ; yalnızca açık atama okunur.
 */
export function personProfileForMonth(personId: string, month: string): PointProfile | null {
  const row = plainOne<{ profile: string }>(
    getDb()
      .prepare(
        `SELECT profile FROM person_point_profiles
          WHERE person_id = ?
            AND effective_from <= ?
            AND (effective_to IS NULL OR effective_to >= ?)
          ORDER BY effective_from DESC LIMIT 1`,
      )
      .get(personId, `${month}-01`, `${month}-01`),
  );
  return row && isPointProfile(row.profile) ? row.profile : null;
}

export function listPersonPointProfiles(): PersonPointProfileRow[] {
  return plainList<PersonPointProfileRow>(
    getDb()
      .prepare(
        `SELECT person_id, profile, effective_from, effective_to
           FROM person_point_profiles ORDER BY person_id, effective_from DESC`,
      )
      .all(),
  );
}

/**
 * Profili atar. Aynı kişinin önceki açık kaydı, yeni dönemin BİR GÜN ÖNCESİNDE
 * kapatılır — geçmiş hak edişler yeniden fiyatlanmaz, yalnızca bundan sonrası
 * yeni profille değerlendirilir.
 */
export function assignPersonPointProfile(input: {
  personId: string;
  profile: PointProfile;
  effectiveFrom: string;
  assignedBy: string;
}): void {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `UPDATE person_point_profiles
          SET effective_to = date(?, '-1 day')
        WHERE person_id = ? AND effective_to IS NULL AND effective_from < ?`,
    ).run(input.effectiveFrom, input.personId, input.effectiveFrom);
    db.prepare(
      `INSERT INTO person_point_profiles (person_id, profile, effective_from, assigned_by)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(person_id, effective_from)
       DO UPDATE SET profile = excluded.profile, effective_to = NULL, assigned_by = excluded.assigned_by`,
    ).run(input.personId, input.profile, input.effectiveFrom, input.assignedBy);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
