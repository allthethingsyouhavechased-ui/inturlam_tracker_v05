import { getDb, plainList } from "@/lib/db/client";
import type { BrandPersonAssignment, PersonBrandAssignment } from "@/lib/types";

export function listPersonBrandAssignments(personId: string): PersonBrandAssignment[] {
  return plainList<PersonBrandAssignment>(
    getDb().prepare(
      `SELECT a.person_id, a.brand_id, b.name AS brand_name, b.logo_path AS brand_logo_path,
              a.created_at
         FROM person_brand_assignments a
         JOIN brands b ON b.id = a.brand_id
        WHERE a.person_id = ? AND b.archived = 0
        ORDER BY b.sort_order, b.name`,
    ).all(personId),
  );
}

export function listAllPersonBrandAssignments(): PersonBrandAssignment[] {
  return plainList<PersonBrandAssignment>(
    getDb().prepare(
      `SELECT a.person_id, a.brand_id, b.name AS brand_name, b.logo_path AS brand_logo_path,
              a.created_at
         FROM person_brand_assignments a
         JOIN brands b ON b.id = a.brand_id
        WHERE b.archived = 0
        ORDER BY a.person_id, b.sort_order, b.name`,
    ).all(),
  );
}

export function listBrandPersonAssignments(brandId: string): BrandPersonAssignment[] {
  return plainList<BrandPersonAssignment>(
    getDb().prepare(
      `SELECT a.person_id, p.name AS person_name, p.avatar_path AS person_avatar_path,
              p.title AS person_title, a.brand_id, a.created_at
         FROM person_brand_assignments a
         JOIN people p ON p.id = a.person_id
        WHERE a.brand_id = ? AND p.active = 1
        ORDER BY p.name`,
    ).all(brandId),
  );
}

export function replaceBrandPersonAssignments(
  brandId: string,
  personIds: string[],
  assignedBy: string,
): void {
  const db = getDb();
  const unique = [...new Set(personIds.filter(Boolean))];
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM person_brand_assignments WHERE brand_id = ?").run(brandId);
    const insert = db.prepare(
      `INSERT INTO person_brand_assignments (person_id, brand_id, assigned_by)
       SELECT id, ?, ? FROM people WHERE id = ? AND active = 1`,
    );
    for (const personId of unique) insert.run(brandId, assignedBy, personId);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
