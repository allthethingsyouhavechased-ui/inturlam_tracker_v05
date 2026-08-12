import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-v03-task-rules-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;
const { getDb } = await import("@/lib/db/client");
const { createTask, updateTaskDueDate, updateTaskWeight } = await import("@/lib/repositories/tasks");

function resetDb() { globalThis.__inturlamDb?.close(); globalThis.__inturlamDb = undefined; for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true }); }
beforeEach(resetDb); after(resetDb);

describe("v03 görev tarih ve ağırlık kuralları", () => {
  it("ekip görevi tarihsiz açılamaz ve tarih temizlenemez", () => {
    const db = getDb(); db.prepare("INSERT INTO brands (id,name,cluster) VALUES ('b1','Bir','tek')").run(); db.prepare("INSERT INTO content_items (id,brand_id,title,type) VALUES ('c1','b1','İş','Diger')").run();
    assert.throws(() => createTask({ contentItemId: "c1", title: "Tarihsiz", assigneeId: null, dueDate: "" }), /Teslim tarihi zorunlu/);
    const id = createTask({ contentItemId: "c1", title: "Tarihli", assigneeId: null, dueDate: "2026-08-20" });
    assert.throws(() => updateTaskDueDate(id, ""), /Teslim tarihi zorunlu/);
  });

  it("veritabanı ağırlığı yalnızca 1-100 aralığında kabul eder", () => {
    const db = getDb(); db.prepare("INSERT INTO brands (id,name,cluster) VALUES ('b1','Bir','tek')").run(); db.prepare("INSERT INTO content_items (id,brand_id,title,type) VALUES ('c1','b1','İş','Diger')").run(); const id = createTask({ contentItemId: "c1", title: "İş", assigneeId: null, dueDate: "2026-08-20" });
    updateTaskWeight(id, 100);
    assert.throws(() => updateTaskWeight(id, 101));
  });
});
