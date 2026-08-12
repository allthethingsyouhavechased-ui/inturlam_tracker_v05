import { createHash, randomBytes } from "node:crypto";
import { SESSION_TTL_SECONDS } from "@/lib/auth/constants";
import { getDb, plainOne } from "@/lib/db/client";
import type { Person } from "@/lib/types";

const PUBLIC_PERSON_COLUMNS =
  "p.id, p.name, p.title, p.bio, p.avatar_path, p.department, p.is_manager, p.active";

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createAuthSession(personId: string): string {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const db = getDb();
  db.prepare("DELETE FROM auth_sessions WHERE expires_at <= unixepoch()").run();
  db.prepare(
    "INSERT INTO auth_sessions (token_hash, person_id, expires_at) VALUES (?, ?, ?)",
  ).run(tokenHash(token), personId, expiresAt);
  return token;
}

export function getPersonForSession(token: string): Person | undefined {
  return plainOne<Person>(
    getDb()
      .prepare(
        `SELECT ${PUBLIC_PERSON_COLUMNS}
           FROM auth_sessions s
           JOIN people p ON p.id = s.person_id
          WHERE s.token_hash = ?
            AND s.expires_at > unixepoch()
            AND p.active = 1`,
      )
      .get(tokenHash(token)),
  );
}

export function deleteAuthSession(token: string): void {
  getDb().prepare("DELETE FROM auth_sessions WHERE token_hash = ?").run(tokenHash(token));
}

export function deleteAuthSessionsForPerson(personId: string): void {
  getDb().prepare("DELETE FROM auth_sessions WHERE person_id = ?").run(personId);
}
