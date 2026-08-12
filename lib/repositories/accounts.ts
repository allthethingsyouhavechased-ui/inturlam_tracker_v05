import { getDb, plainList, plainOne } from "@/lib/db/client";

export interface GuestAccountRow {
  id: string;
  brand_id: string;
  brand_name: string;
  username: string;
  active: number;
  has_password: number;
  created_at: string;
  updated_at: string;
}

export interface GuestCredentials {
  id: string;
  brand_id: string;
  username: string;
  password_hash: string | null;
  active: number;
}

export function listGuestAccounts(): GuestAccountRow[] {
  return plainList<GuestAccountRow>(
    getDb()
      .prepare(
        `SELECT a.id, a.brand_id, b.name AS brand_name, a.username, a.active,
                CASE WHEN a.password_hash IS NULL THEN 0 ELSE 1 END AS has_password,
                a.created_at, a.updated_at
           FROM accounts a
           JOIN brands b ON b.id = a.brand_id
          WHERE a.kind = 'guest'
          ORDER BY b.name`,
      )
      .all(),
  );
}

export function getGuestCredentials(username: string): GuestCredentials | undefined {
  return plainOne<GuestCredentials>(
    getDb()
      .prepare(
        `SELECT id, brand_id, username, password_hash, active
           FROM accounts
          WHERE kind = 'guest' AND username = ? COLLATE NOCASE`,
      )
      .get(username),
  );
}

export function getActiveGuestAccountForBrand(brandId: string): Pick<GuestAccountRow, "id" | "brand_id" | "brand_name" | "username"> | undefined {
  return plainOne<Pick<GuestAccountRow, "id" | "brand_id" | "brand_name" | "username">>(
    getDb().prepare(
      `SELECT a.id, a.brand_id, b.name AS brand_name, a.username
         FROM accounts a
         JOIN brands b ON b.id = a.brand_id
        WHERE a.kind = 'guest' AND a.brand_id = ? AND a.active = 1`,
    ).get(brandId),
  );
}

export function upsertGuestAccount(input: {
  brandId: string;
  username: string;
  passwordHash: string;
}): string {
  const db = getDb();
  const current = plainOne<{ id: string }>(
    db.prepare("SELECT id FROM accounts WHERE kind = 'guest' AND brand_id = ?").get(input.brandId),
  );
  if (current) {
    db.prepare(
      `UPDATE accounts
          SET username = ?, password_hash = ?, active = 1, updated_at = datetime('now')
        WHERE id = ?`,
    ).run(input.username, input.passwordHash, current.id);
    return current.id;
  }

  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO accounts
       (id, kind, person_id, brand_id, username, password_hash, active)
     VALUES (?, 'guest', NULL, ?, ?, ?, 1)`,
  ).run(id, input.brandId, input.username, input.passwordHash);
  return id;
}

export function setGuestAccountActive(id: string, active: boolean): void {
  getDb()
    .prepare("UPDATE accounts SET active = ?, updated_at = datetime('now') WHERE id = ? AND kind = 'guest'")
    .run(active ? 1 : 0, id);
}
