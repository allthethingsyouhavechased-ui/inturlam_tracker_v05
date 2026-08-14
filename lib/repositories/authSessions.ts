import { createHash, randomBytes } from "node:crypto";
import { SESSION_TTL_SECONDS } from "@/lib/auth/constants";
import { getDb, plainOne } from "@/lib/db/client";
import type { Actor, GuestActor, Person, TeamActor } from "@/lib/types";

const PUBLIC_PERSON_COLUMNS =
  "p.id, p.username, p.name, p.title, p.bio, p.avatar_path, p.department, p.is_manager, p.active";

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function issueSession(accountId: string): string {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const db = getDb();
  db.prepare("DELETE FROM account_sessions WHERE expires_at <= unixepoch()").run();
  db.prepare(
    "INSERT INTO account_sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)",
  ).run(tokenHash(token), accountId, expiresAt);
  return token;
}

export function createAuthSession(personId: string): string {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO accounts
       (id, kind, person_id, brand_id, username, password_hash, active)
     SELECT 'team:' || id, 'team', id, NULL, NULL, password_hash, active
       FROM people WHERE id = ?`,
  ).run(personId);
  const account = plainOne<{ id: string }>(
    db.prepare("SELECT id FROM accounts WHERE kind = 'team' AND person_id = ? AND active = 1")
      .get(personId),
  );
  if (!account) throw new Error("Aktif ekip hesabı bulunamadı.");
  return issueSession(account.id);
}

export function createGuestAuthSession(accountId: string): string {
  const account = plainOne<{ id: string }>(
    getDb()
      .prepare("SELECT id FROM accounts WHERE id = ? AND kind = 'guest' AND active = 1")
      .get(accountId),
  );
  if (!account) throw new Error("Aktif guest hesabı bulunamadı.");
  return issueSession(account.id);
}

export function getActorForSession(token: string): Actor | undefined {
  const db = getDb();
  const session = plainOne<{
    account_id: string;
    kind: "team" | "guest";
    person_id: string | null;
    brand_id: string | null;
    username: string | null;
  }>(
    db.prepare(
      `SELECT a.id AS account_id, a.kind, a.person_id, a.brand_id, a.username
         FROM account_sessions s
         JOIN accounts a ON a.id = s.account_id
        WHERE s.token_hash = ?
          AND s.expires_at > unixepoch()
          AND a.active = 1`,
    ).get(tokenHash(token)),
  );
  if (!session) return undefined;

  if (session.kind === "team" && session.person_id) {
    const person = plainOne<Person>(
      db.prepare(`SELECT ${PUBLIC_PERSON_COLUMNS} FROM people p WHERE p.id = ? AND p.active = 1`)
        .get(session.person_id),
    );
    if (!person) return undefined;
    return { kind: "team", account_id: session.account_id, person } satisfies TeamActor;
  }

  if (session.kind === "guest" && session.brand_id && session.username) {
    const brand = plainOne<{ id: string; name: string; logo_path: string | null }>(
      db.prepare("SELECT id, name, logo_path FROM brands WHERE id = ? AND archived = 0")
        .get(session.brand_id),
    );
    if (!brand) return undefined;
    return {
      kind: "guest",
      account_id: session.account_id,
      brand,
      username: session.username,
    } satisfies GuestActor;
  }
  return undefined;
}

// Eski ekip yüzeyleri kademeli geçerken yalnızca team oturumunu Person'a indirger.
export function getPersonForSession(token: string): Person | undefined {
  const actor = getActorForSession(token);
  return actor?.kind === "team" ? actor.person : undefined;
}

export function deleteAuthSession(token: string): void {
  getDb().prepare("DELETE FROM account_sessions WHERE token_hash = ?").run(tokenHash(token));
}

export function deleteAuthSessionsForPerson(personId: string): void {
  getDb()
    .prepare(
      `DELETE FROM account_sessions
        WHERE account_id IN (SELECT id FROM accounts WHERE kind = 'team' AND person_id = ?)`,
    )
    .run(personId);
}

export function deleteAuthSessionsForAccount(accountId: string): void {
  getDb().prepare("DELETE FROM account_sessions WHERE account_id = ?").run(accountId);
}
