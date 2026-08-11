import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-notifications-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const { createNotification, markNotificationRead } = await import("@/lib/repositories/notifications");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true });
}

beforeEach(() => {
  resetDb();
  const db = getDb();
  db.prepare("INSERT INTO people (id, name) VALUES ('a', 'Ada'), ('b', 'Bora')").run();
});

after(resetDb);

describe("bildirim sahipliği", () => {
  it("bir kullanıcı başka bir kullanıcının bildirimini okundu yapamaz", () => {
    const id = createNotification({
      recipientId: "a",
      recipientName: "Ada",
      actorId: "b",
      actorName: "Bora",
      taskId: null,
      brandId: null,
      summary: "Test bildirimi",
    });

    assert.equal(markNotificationRead(id, "b"), false);
    assert.equal((getDb().prepare("SELECT read FROM notifications WHERE id = ?").get(id) as { read: number }).read, 0);
    assert.equal(markNotificationRead(id, "a"), true);
    assert.equal((getDb().prepare("SELECT read FROM notifications WHERE id = ?").get(id) as { read: number }).read, 1);
  });
});
