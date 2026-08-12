import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-v03-guest-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;
const { getDb } = await import("@/lib/db/client");
const {
  createGuestTask,
  deleteGuestOwnedSharedAttachment,
  getGuestTask,
  listGuestTasks,
  updateGuestTask,
} = await import("@/lib/repositories/guestTasks");
const { listAllTasks, listTasksByContent, updateTaskAssignee, updateTaskDueDate, updateTaskStatus, bulkUpdateTaskStatus } = await import("@/lib/repositories/tasks");
const { setPersonalTaskTarget } = await import("@/lib/repositories/personalTargets");
const { listBrandsWithOpenCounts } = await import("@/lib/repositories/brands");
const { listContentByBrand } = await import("@/lib/repositories/content");
const { getReportSummary } = await import("@/lib/repositories/reports");
const { searchAll } = await import("@/lib/repositories/search");
const { listUploadPathsForBrand, listUploadPathsForContent, listUploadPathsForTaskIds } = await import("@/lib/repositories/uploadReferences");

function resetDb() {
  globalThis.__inturlamDb?.close(); globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true });
}
function seed() {
  const db = getDb();
  db.prepare("INSERT INTO brands (id,name,cluster) VALUES ('b1','Bir','tek'),('b2','İki','tek')").run();
  db.prepare("INSERT INTO people (id,name,password_hash) VALUES ('p1','Person','hash')").run();
  db.prepare("INSERT INTO accounts (id,kind,brand_id,username,password_hash) VALUES ('g1','guest','b1','bir','hash'),('g2','guest','b2','iki','hash')").run();
  return db;
}
beforeEach(resetDb); after(resetDb);

describe("v03 guest görev sözleşmesi", () => {
  it("görevi iç teslim tarihi olmadan planlama kuyruğuna açar ve marka dışına sızdırmaz", () => {
    const db = seed();
    const id = createGuestTask({ brandId: "b1", accountId: "g1", title: "Çekim", brief: "Yeni ürün", requestedDate: "2026-08-20", attachments: [] });
    const stored = db.prepare("SELECT due_date, requested_date, origin, weight_points FROM tasks WHERE id = ?").get(id) as Record<string, unknown>;
    assert.deepEqual({ ...stored }, { due_date: null, requested_date: "2026-08-20", origin: "guest", weight_points: 1 });
    assert.equal(listGuestTasks("b2", "g2").length, 0);
  });

  it("DTO iç alanları hiç döndürmez ve çalışma başlayınca briefi kilitler", () => {
    const db = seed();
    const id = createGuestTask({ brandId: "b1", accountId: "g1", title: "Çekim", brief: "Yeni ürün", requestedDate: "2026-08-20", attachments: [] });
    const dto = getGuestTask(id, "b1", "g1")! as unknown as Record<string, unknown>;
    for (const forbidden of ["due_date", "assignee_id", "weight_points", "notes", "personal_target_date"]) assert.equal(forbidden in dto, false, forbidden);
    assert.equal(updateGuestTask({ taskId: id, brandId: "b1", title: "Yeni", brief: "Yeni", requestedDate: "2026-08-21" }), true);
    db.prepare("UPDATE tasks SET status = 'DevamEdiyor' WHERE id = ?").run(id);
    assert.equal(updateGuestTask({ taskId: id, brandId: "b1", title: "Sızma", brief: "Sızma", requestedDate: "2026-08-22" }), false);
  });

  it("planlanana kadar yalnizca kuyrukta kalir ve durumu ilerletilemez", () => {
    const db = seed();
    const id = createGuestTask({ brandId: "b1", accountId: "g1", title: "Guest shoot", brief: "Brief", requestedDate: "2026-08-20", attachments: [] });
    const contentId = (db.prepare("SELECT content_item_id FROM tasks WHERE id = ?").get(id) as { content_item_id: string }).content_item_id;

    assert.equal(listAllTasks(true).some((task) => task.id === id), false);
    assert.equal(listTasksByContent(contentId).length, 0);
    assert.equal(listContentByBrand("b1").some((item) => item.id === contentId), false);
    assert.equal(listBrandsWithOpenCounts().find((brand) => brand.id === "b1")?.open_count, 0);
    assert.equal(getReportSummary(null, "2026-08-01").open_tasks, 0);
    assert.equal(searchAll("Guest shoot").tasks.length, 0);
    assert.throws(() => updateTaskStatus(id, "DevamEdiyor"), /teslim tarihi/i);
    assert.throws(() => bulkUpdateTaskStatus([id], "DevamEdiyor"), /teslim tarihi/i);
    updateTaskAssignee(id, "p1");
    assert.throws(() => setPersonalTaskTarget(id, "p1", "2026-08-19", "2026-08-12"), /teslim tarihi/i);

    updateTaskDueDate(id, "2026-08-22");
    assert.equal(updateTaskStatus(id, "DevamEdiyor"), true);
    assert.equal(listAllTasks(true).some((task) => task.id === id), true);
    assert.equal(listTasksByContent(contentId).length, 1);
    assert.equal(listContentByBrand("b1").some((item) => item.id === contentId), true);
    assert.equal(listBrandsWithOpenCounts().find((brand) => brand.id === "b1")?.open_count, 1);
    assert.equal(getReportSummary(null, "2026-08-01").open_tasks, 1);
  });

  it("guest DTO ic kimlikleri sizdirmaz ve ek silmeyi sahibine sinirlar", () => {
    const db = seed();
    const id = createGuestTask({
      brandId: "b1",
      accountId: "g1",
      title: "Attachment ownership",
      brief: "Brief",
      requestedDate: "2026-08-20",
      attachments: [{ filePath: "/uploads/guest-tasks/own.png", originalName: "own.png" }],
    });
    db.prepare(
      "INSERT INTO task_shared_attachments (id, task_id, account_id, file_path, original_name) VALUES ('other', ?, 'g2', '/uploads/guest-tasks/other.png', 'other.png')",
    ).run(id);

    const dto = getGuestTask(id, "b1", "g1")!;
    assert.equal("account_id" in dto.attachments[0], false);
    assert.equal("task_id" in dto.attachments[0], false);
    assert.equal(dto.attachments.find((item) => item.original_name === "own.png")?.can_delete, true);
    assert.equal(dto.attachments.find((item) => item.original_name === "other.png")?.can_delete, false);
    assert.throws(() => deleteGuestOwnedSharedAttachment("other", id, "g1"), /kendi eklerinizi/i);
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM task_shared_attachments WHERE id = 'other'").get() as { count: number }).count, 1);

    const ownId = (db.prepare("SELECT id FROM task_shared_attachments WHERE original_name = 'own.png'").get() as { id: string }).id;
    assert.equal(deleteGuestOwnedSharedAttachment(ownId, id, "g1")?.original_name, "own.png");
    assert.equal((db.prepare("SELECT COUNT(*) AS count FROM task_shared_attachments WHERE id = ?").get(ownId) as { count: number }).count, 0);
  });

  it("cascade silmeden once tum bagli runtime dosyalarini bulur", () => {
    const db = seed();
    const id = createGuestTask({
      brandId: "b1",
      accountId: "g1",
      title: "Cleanup",
      brief: "Brief",
      requestedDate: "2026-08-20",
      attachments: [{ filePath: "/uploads/guest-tasks/shared.png", originalName: "shared.png" }],
    });
    const contentId = (db.prepare("SELECT content_item_id FROM tasks WHERE id = ?").get(id) as { content_item_id: string }).content_item_id;
    db.prepare("INSERT INTO comments (id, task_id, author_id, body) VALUES ('c1', ?, 'p1', 'Comment')").run(id);
    db.prepare("INSERT INTO comment_attachments (id, comment_id, file_path) VALUES ('ca1', 'c1', '/uploads/comments/comment.png')").run();
    db.prepare("INSERT INTO task_attachments (id, task_id, file_path) VALUES ('ta1', ?, '/uploads/tasks/task.png')").run(id);

    const expected = [
      "/uploads/comments/comment.png",
      "/uploads/guest-tasks/shared.png",
      "/uploads/tasks/task.png",
    ];
    assert.deepEqual(listUploadPathsForTaskIds([id]), expected);
    assert.deepEqual(listUploadPathsForContent(contentId), expected);
    assert.deepEqual(listUploadPathsForBrand("b1"), expected);
  });
});
