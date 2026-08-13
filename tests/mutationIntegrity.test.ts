import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-mutation-integrity-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { activeAssigneeId } = await import("@/lib/assignees");
const { getDb } = await import("@/lib/db/client");
const {
  bulkDeleteTasks,
  bulkUpdateTaskAssignee,
  bulkUpdateTaskPriority,
  updateTaskAssignee,
  updateTaskPriority,
} = await import("@/lib/repositories/tasks");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(TMP_DB + suffix, { force: true });
  }
}

function seedBase(): void {
  const db = getDb();
  db.prepare("INSERT INTO people (id, name, active) VALUES ('p1', 'Aktif Bir', 1)").run();
  db.prepare("INSERT INTO people (id, name, active) VALUES ('p2', 'Aktif İki', 1)").run();
  db.prepare("INSERT INTO people (id, name, active) VALUES ('p3', 'Pasif Kişi', 0)").run();
  db.prepare("INSERT INTO brands (id, name, cluster) VALUES ('b1', 'Test Marka', 'tek')").run();
  db.prepare(
    "INSERT INTO content_items (id, brand_id, title, type) VALUES ('c1', 'b1', 'Test İçerik', 'Post')",
  ).run();
  db.prepare(
    `INSERT INTO tasks (id, content_item_id, title, priority, assignee_id, due_date)
     VALUES ('t1', 'c1', 'Bir', 'Normal', 'p1', '2026-08-20')`,
  ).run();
  db.prepare(
    `INSERT INTO tasks (id, content_item_id, title, priority, assignee_id, due_date)
     VALUES ('t2', 'c1', 'İki', 'Yuksek', 'p2', '2026-08-21')`,
  ).run();
}

beforeEach(() => {
  resetDb();
  seedBase();
});
after(resetDb);

describe("mutasyon sonucu bütünlüğü", () => {
  it("tekil öncelik ve atamada yalnızca gerçek değişikliği başarı sayar", () => {
    assert.equal(updateTaskPriority("missing", "Acil"), false);
    assert.equal(updateTaskPriority("t1", "Normal"), false);
    assert.equal(updateTaskPriority("t1", "Acil"), true);

    assert.equal(updateTaskAssignee("missing", "p2"), false);
    assert.equal(updateTaskAssignee("t1", "p1"), false);
    assert.equal(updateTaskAssignee("t1", "p2"), true);
  });

  it("toplu işlemlerde gönderilen değil gerçekten değişen satır sayısını döndürür", () => {
    assert.equal(bulkUpdateTaskPriority(["t1", "t2", "missing"], "Yuksek"), 1);
    assert.equal(bulkUpdateTaskPriority(["t1", "t2", "missing"], "Yuksek"), 0);

    assert.equal(bulkUpdateTaskAssignee(["t1", "t2", "missing"], "p2"), 1);
    assert.equal(bulkUpdateTaskAssignee(["t1", "t2", "missing"], "p2"), 0);

    assert.equal(bulkDeleteTasks(["t1", "missing"]), 1);
    assert.equal(bulkDeleteTasks(["t1", "missing"]), 0);
  });

  it("pasif veya var olmayan kişiye atamayı sunucu katmanında reddeder", () => {
    assert.equal(activeAssigneeId(null), null);
    assert.equal(activeAssigneeId(" p1 "), "p1");
    assert.throws(() => activeAssigneeId("p3"), /aktif ekip üyesi/);
    assert.throws(() => activeAssigneeId("missing"), /aktif ekip üyesi/);
  });
});
