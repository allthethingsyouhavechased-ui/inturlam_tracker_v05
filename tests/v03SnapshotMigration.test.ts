import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, describe, it } from "node:test";

const SOURCE = "C:\\Users\\intur\\repos\\inturlam-tracker\\data\\backup\\20260812-124851\\inturlam.db";
const TMP_DB = path.join(os.tmpdir(), `inturlam-test-v03-real-snapshot-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

let getDb: typeof import("@/lib/db/client")["getDb"];

after(() => {
  globalThis.__inturlamDb?.close(); globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true });
});

describe("gerçek v02 snapshot v03 migrationı", () => {
  it("hesap, görev, yorum ve bütünlüğü veri kaybetmeden korur", { skip: !fs.existsSync(SOURCE) }, async () => {
    const before = new DatabaseSync(SOURCE, { readOnly: true });
    const counts = Object.fromEntries(["brands", "people", "content_items", "tasks", "comments"].map((table) => [table, (before.prepare(`SELECT COUNT(*) c FROM ${table}`).get() as { c: number }).c]));
    const passwords = before.prepare("SELECT id, password_hash FROM people ORDER BY id").all().map((row) => ({ ...row }));
    before.close();
    fs.copyFileSync(SOURCE, TMP_DB);
    ({ getDb } = await import("@/lib/db/client"));
    const db = getDb();
    for (const [table, count] of Object.entries(counts)) assert.equal((db.prepare(`SELECT COUNT(*) c FROM ${table}`).get() as { c: number }).c, count, table);
    assert.equal((db.prepare("SELECT COUNT(*) c FROM accounts WHERE kind = 'team'").get() as { c: number }).c, counts.people);
    const migratedPasswords = db.prepare("SELECT p.id, a.password_hash FROM people p JOIN accounts a ON a.person_id = p.id ORDER BY p.id").all().map((row) => ({ ...row }));
    assert.deepEqual(migratedPasswords, passwords);
    assert.equal((db.prepare("SELECT COUNT(*) c FROM tasks WHERE weight_points = 1 AND origin = 'team'").get() as { c: number }).c, counts.tasks);
    assert.equal((db.prepare("PRAGMA integrity_check").get() as { integrity_check: string }).integrity_check, "ok");
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  });
});
