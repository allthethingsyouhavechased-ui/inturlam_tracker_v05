import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-auth-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const {
  createAuthSession,
  deleteAuthSession,
  getPersonForSession,
} = await import("@/lib/repositories/authSessions");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true });
}

beforeEach(resetDb);
after(resetDb);

describe("veritabanı oturumları", () => {
  it("tarayıcı tokenini özetleyerek saklar ve aktif kişiyi çözer", () => {
    const db = getDb();
    db.prepare(
      "INSERT INTO people (id, name, is_manager) VALUES ('yunus', 'Yunus Emre', 1)",
    ).run();

    const token = createAuthSession("yunus");
    const stored = db.prepare("SELECT token_hash FROM auth_sessions").get() as {
      token_hash: string;
    };
    const expiresAt = Number(
      (db.prepare("SELECT expires_at FROM auth_sessions").get() as { expires_at: number })
        .expires_at,
    );
    const remainingSeconds = expiresAt - Math.floor(Date.now() / 1000);

    assert.notEqual(token, "yunus");
    assert.notEqual(stored.token_hash, token);
    assert.equal(stored.token_hash.length, 64);
    assert.ok(remainingSeconds <= 60 * 60 * 12);
    assert.ok(remainingSeconds >= 60 * 60 * 12 - 2);
    assert.equal(getPersonForSession(token)?.is_manager, 1);

    deleteAuthSession(token);
    assert.equal(getPersonForSession(token), undefined);
  });

  it("süresi dolmuş oturumu kabul etmez", () => {
    const db = getDb();
    db.prepare("INSERT INTO people (id, name) VALUES ('p1', 'Ada')").run();
    const token = createAuthSession("p1");
    db.prepare("UPDATE auth_sessions SET expires_at = unixepoch() - 1").run();
    assert.equal(getPersonForSession(token), undefined);
  });
});
