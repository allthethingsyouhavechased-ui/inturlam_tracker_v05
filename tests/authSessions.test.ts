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
  createGuestAuthSession,
  deleteAuthSession,
  getActorForSession,
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
    const stored = db.prepare("SELECT token_hash FROM account_sessions").get() as {
      token_hash: string;
    };
    const expiresAt = Number(
      (db.prepare("SELECT expires_at FROM account_sessions").get() as { expires_at: number })
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
    db.prepare("UPDATE account_sessions SET expires_at = unixepoch() - 1").run();
    assert.equal(getPersonForSession(token), undefined);
  });

  it("guest hesabını marka kapsamlı actor olarak çözer", () => {
    const db = getDb();
    db.prepare("INSERT INTO brands (id, name, cluster) VALUES ('b1', 'Marka', 'tek')").run();
    db.prepare("INSERT INTO accounts (id, kind, brand_id, username, password_hash) VALUES ('g1', 'guest', 'b1', 'marka', 'hash')").run();
    const token = createGuestAuthSession("g1");
    const actor = getActorForSession(token);
    assert.equal(actor?.kind, "guest");
    if (actor?.kind === "guest") assert.equal(actor.brand.id, "b1");
    assert.equal(getPersonForSession(token), undefined);
  });
});
