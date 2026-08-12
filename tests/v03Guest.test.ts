import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-v03-guest-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;
const { getDb } = await import("@/lib/db/client");
const { createGuestTask, getGuestTask, listGuestTasks, updateGuestTask } = await import("@/lib/repositories/guestTasks");

function resetDb() {
  globalThis.__inturlamDb?.close(); globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true });
}
function seed() {
  const db = getDb();
  db.prepare("INSERT INTO brands (id,name,cluster) VALUES ('b1','Bir','tek'),('b2','İki','tek')").run();
  db.prepare("INSERT INTO accounts (id,kind,brand_id,username,password_hash) VALUES ('g1','guest','b1','bir','hash')").run();
  return db;
}
beforeEach(resetDb); after(resetDb);

describe("v03 guest görev sözleşmesi", () => {
  it("görevi iç teslim tarihi olmadan planlama kuyruğuna açar ve marka dışına sızdırmaz", () => {
    const db = seed();
    const id = createGuestTask({ brandId: "b1", accountId: "g1", title: "Çekim", brief: "Yeni ürün", requestedDate: "2026-08-20", attachments: [] });
    const stored = db.prepare("SELECT due_date, requested_date, origin, weight_points FROM tasks WHERE id = ?").get(id) as Record<string, unknown>;
    assert.deepEqual({ ...stored }, { due_date: null, requested_date: "2026-08-20", origin: "guest", weight_points: 1 });
    assert.equal(listGuestTasks("b2").length, 0);
  });

  it("DTO iç alanları hiç döndürmez ve çalışma başlayınca briefi kilitler", () => {
    const db = seed();
    const id = createGuestTask({ brandId: "b1", accountId: "g1", title: "Çekim", brief: "Yeni ürün", requestedDate: "2026-08-20", attachments: [] });
    const dto = getGuestTask(id, "b1")! as unknown as Record<string, unknown>;
    for (const forbidden of ["due_date", "assignee_id", "weight_points", "notes", "personal_target_date"]) assert.equal(forbidden in dto, false, forbidden);
    assert.equal(updateGuestTask({ taskId: id, brandId: "b1", title: "Yeni", brief: "Yeni", requestedDate: "2026-08-21" }), true);
    db.prepare("UPDATE tasks SET status = 'DevamEdiyor' WHERE id = ?").run(id);
    assert.equal(updateGuestTask({ taskId: id, brandId: "b1", title: "Sızma", brief: "Sızma", requestedDate: "2026-08-22" }), false);
  });
});
