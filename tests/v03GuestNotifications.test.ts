import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-v03-guest-notifications-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;
const { getDb } = await import("@/lib/db/client");
const { createGuestTask } = await import("@/lib/repositories/guestTasks");
const { updateTaskAssignee } = await import("@/lib/repositories/tasks");
const { listNotificationsForRecipient } = await import("@/lib/repositories/notifications");
const { listActivityForEntity } = await import("@/lib/repositories/activity");
const {
  announceGuestComment,
  announceGuestRequestCreated,
  announceGuestTaskPlanned,
  announceGuestTaskStatus,
  announceTeamSharedReply,
} = await import("@/lib/guestTaskCommunications");

function resetDb() {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true });
}

function seed() {
  const db = getDb();
  db.prepare("INSERT INTO brands (id,name,cluster) VALUES ('b1','Bir','tek')").run();
  db.prepare(`INSERT INTO people (id,name,is_manager,active) VALUES
    ('manager','Meral',1,1),('worker','Ada',0,1),('inactive','Pasif',1,0)`).run();
  db.prepare("INSERT INTO accounts (id,kind,brand_id,username,active) VALUES ('g1','guest','b1','bir-guest',1)").run();
  const taskId = createGuestTask({
    brandId: "b1",
    accountId: "g1",
    title: "Ürün çekimi",
    brief: "Yeni koleksiyon",
    requestedDate: "2026-08-20",
    attachments: [],
  });
  updateTaskAssignee(taskId, "worker");
  return { db, taskId };
}

beforeEach(resetDb);
after(resetDb);

describe("v03 guest–ekip bildirim zinciri", () => {
  it("guest talebini değerlendiricilere; yorumunu yönetici ve görev sahibine bildirir", async () => {
    const { taskId } = seed();
    const base = {
      guestAccountId: "g1",
      guestName: "Bir Guest",
      taskId,
      taskTitle: "Ürün çekimi",
      brandId: "b1",
    };

    // Yeni istek artık üretim görevi değil TALEP açıyor; bildirim de talebe
    // bağlanıyor ve `task_id` taşımıyor (ortada henüz görev yok).
    await announceGuestRequestCreated({
      guestName: "Bir Guest",
      requestId: "req-1",
      requestTitle: "Ürün çekimi",
      brandId: "b1",
    });
    await announceGuestComment({ ...base, assigneeId: "worker", body: "Moodboard eklendi." });

    const manager = listNotificationsForRecipient("manager");
    const worker = listNotificationsForRecipient("worker");
    assert.equal(manager.filter((item) => item.summary.includes("değerlendirme kuyruğuna")).length, 1);
    assert.equal(manager.filter((item) => item.summary.includes("yorum ekledi")).length, 1);
    assert.equal(worker.filter((item) => item.summary.includes("yorum ekledi")).length, 1);
    assert.equal(listNotificationsForRecipient("inactive").length, 0);
    assert.equal(
      manager.find((item) => item.summary.includes("değerlendirme kuyruğuna"))?.task_id,
      null,
    );
    // Talep etkinliği görev akışına değil talep kaydına yazılıyor.
    assert.deepEqual(
      listActivityForEntity("request", "req-1").map((item) => item.action),
      ["guest.request.created"],
    );
    assert.equal(
      listActivityForEntity("task", taskId).some((item) => item.action === "guest.request.created"),
      false,
    );
  });

  it("ekip yanıtı, ilk planlama ve durum değişikliğini doğru guest hesabına bildirir", async () => {
    const { taskId } = seed();
    const actor = { id: "worker", username: "worker", name: "Ada", title: null, bio: null, avatar_path: null, department: null, is_manager: 0, active: 1 } as const;
    const base = { actor, taskId, taskTitle: "Ürün çekimi", brandId: "b1" };

    await announceTeamSharedReply({ ...base, body: "Dosyaları aldık." });
    await announceGuestTaskPlanned(base);
    await announceGuestTaskStatus({ ...base, statusLabel: "Devam Ediyor" });

    const guest = listNotificationsForRecipient("g1");
    assert.equal(guest.length, 3);
    assert.ok(guest.some((item) => item.summary.includes("yanıt verdi")));
    assert.ok(guest.some((item) => item.summary.includes("planladı")));
    assert.ok(guest.some((item) => item.summary.includes("Devam Ediyor")));
    assert.equal(guest.every((item) => item.task_id === taskId), true);

    const actions = listActivityForEntity("task", taskId).map((item) => item.action);
    assert.ok(actions.includes("team.shared_reply"));
    assert.ok(actions.includes("guest.task.planned"));
    assert.ok(actions.includes("guest.task.status"));
  });

  it("Server Action akışları iletişim zincirine bağlıdır ve guest bildirimi göreve gider", () => {
    const guestActions = fs.readFileSync(path.join(process.cwd(), "lib/actions/guestTasks.ts"), "utf8");
    const taskActions = fs.readFileSync(path.join(process.cwd(), "lib/actions/tasks.ts"), "utf8");
    const bell = fs.readFileSync(path.join(process.cwd(), "components/GuestNotificationBell.tsx"), "utf8");

    for (const name of ["announceGuestRequestCreated", "announceGuestComment", "announceTeamSharedReply"]) {
      assert.match(guestActions, new RegExp(name));
    }
    for (const name of ["announceGuestTaskPlanned", "announceGuestTaskStatus"]) {
      assert.match(taskActions, new RegExp(name));
    }
    assert.match(bell, /item\.task_id\s*\?\s*`\/guest\/tasks\/\$\{item\.task_id\}`/);
  });
});
