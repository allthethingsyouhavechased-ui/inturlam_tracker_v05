import { getDb, plainList } from "@/lib/db/client";

export interface RequestReviewerRow {
  person_id: string;
  person_name: string;
  person_avatar_path: string | null;
  person_active: number;
  created_at: string;
}

/**
 * Talep değerlendirme yetkisi ayrıca verilmiş kişiler. Yöneticiler bu tabloda
 * OLMASA da değerlendirebilir (bkz. lib/requestAccess.ts) — tablo "yönetici
 * olmayan ama yetkili" kişileri tutuyor. Sıla, Defne ve Cansu'nun mevcut
 * hakları migration 030 ile buraya taşındı.
 */
export function listRequestReviewers(): RequestReviewerRow[] {
  return plainList<RequestReviewerRow>(
    getDb()
      .prepare(
        `SELECT r.person_id, p.name AS person_name, p.avatar_path AS person_avatar_path,
                p.active AS person_active, r.created_at
           FROM client_request_reviewers r
           JOIN people p ON p.id = r.person_id
          ORDER BY p.name`,
      )
      .all(),
  );
}

export function isRequestReviewer(personId: string): boolean {
  return Boolean(
    getDb()
      .prepare("SELECT 1 FROM client_request_reviewers WHERE person_id = ?")
      .get(personId),
  );
}

export function setRequestReviewer(personId: string, granted: boolean, grantedBy: string): boolean {
  const db = getDb();
  if (!granted) {
    const result = db
      .prepare("DELETE FROM client_request_reviewers WHERE person_id = ?")
      .run(personId);
    return Number(result.changes) > 0;
  }
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO client_request_reviewers (person_id, granted_by)
       SELECT id, ? FROM people WHERE id = ? AND active = 1`,
    )
    .run(grantedBy, personId);
  return Number(result.changes) > 0;
}
