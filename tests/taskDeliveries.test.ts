import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-task-deliveries-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const {
  createTaskDelivery,
  decideTaskDelivery,
  listGuestTaskDeliveries,
  listTaskDeliveries,
} = await import("@/lib/repositories/deliveries");
const { createGuestTask, getGuestTask } = await import("@/lib/repositories/guestTasks");
const { getDeliveryQualityReport } = await import("@/lib/repositories/reports");
const { createTask, getTask, listTaskRevisions, setTaskArchived, updateTaskStatus } = await import("@/lib/repositories/tasks");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true });
}

function seedBase(): void {
  const db = getDb();
  db.prepare("INSERT INTO brands (id, name, cluster) VALUES ('b1', 'Bir Marka', 'tek'), ('b2', 'İki Marka', 'tek')").run();
  db.prepare("INSERT INTO people (id, name, is_manager) VALUES ('p1', 'Ayşe', 1)").run();
  db.prepare("INSERT INTO accounts (id, kind, person_id) VALUES ('team:p1', 'team', 'p1')").run();
  db.prepare("INSERT INTO accounts (id, kind, brand_id, username) VALUES ('g1', 'guest', 'b1', 'bir-guest'), ('g2', 'guest', 'b2', 'iki-guest')").run();
  db.prepare("INSERT INTO content_items (id, brand_id, title, type) VALUES ('c1', 'b1', 'İçerik', 'Reel')").run();
}

function createTeamTask(): string {
  return createTask({
    contentItemId: "c1",
    title: "Kurgu",
    assigneeId: "p1",
    dueDate: "2026-08-21",
    difficulty: "Orta",
  });
}

function submit(taskId: string, guestVisible = false) {
  return createTaskDelivery({
    taskId,
    note: "İlk sunum",
    externalUrl: "https://example.com/work",
    guestVisible,
    submittedByAccountId: "team:p1",
    submittedByName: "Ayşe",
    submittedByPersonId: "p1",
  }, [{ filePath: "/uploads/deliveries/preview.webp", originalName: "preview.webp" }]);
}

beforeEach(resetDb);
after(resetDb);

describe("versiyonlu görev teslimi", () => {
  it("tek bekleyen teslim tutar, onayı mühürler ve durum geçişini kaydeder", () => {
    seedBase();
    const taskId = createTeamTask();
    const delivery = submit(taskId);

    assert.equal(delivery.version_number, 1);
    assert.equal(delivery.status, "Beklemede");
    assert.equal(delivery.attachments.length, 1);
    assert.equal(getTask(taskId)?.status, "Incelemede");
    assert.throws(() => submit(taskId), /zaten karar bekleyen/i);
    assert.throws(() => updateTaskStatus(taskId, "Yayinlandi", "p1"), /bekleyen teslim/i);
    assert.throws(() => setTaskArchived(taskId, true), /bekleyen teslim/i);

    const approved = decideTaskDelivery({
      deliveryId: delivery.id,
      decision: "Onaylandi",
      actorKind: "team",
      actorAccountId: "team:p1",
      actorName: "Ayşe",
      actorPersonId: "p1",
      decisionNote: "Uygun.",
      revisionReason: null,
      revisionTargetMinutes: null,
    });
    assert.equal(approved.status, "Onaylandi");
    assert.equal(getTask(taskId)?.status, "Onaylandi");
    assert.throws(() => decideTaskDelivery({
      deliveryId: delivery.id,
      decision: "Onaylandi",
      actorKind: "team",
      actorAccountId: "team:p1",
      actorName: "Ayşe",
      actorPersonId: "p1",
      decisionNote: null,
      revisionReason: null,
      revisionTargetMinutes: null,
    }), /daha önce karar/i);
  });

  it("gerekçeli revizeyi açar ve sonraki teslim aktif turu otomatik tamamlar", () => {
    seedBase();
    const taskId = createTeamTask();
    const first = submit(taskId);
    decideTaskDelivery({
      deliveryId: first.id,
      decision: "RevizeIstendi",
      actorKind: "team",
      actorAccountId: "team:p1",
      actorName: "Ayşe",
      actorPersonId: "p1",
      decisionNote: "Kapak metni kısalmalı.",
      revisionReason: "Metin",
      revisionTargetMinutes: 240,
    });

    assert.equal(getTask(taskId)?.status, "DevamEdiyor");
    assert.equal(listTaskRevisions(taskId)[0]?.completed_at, null);
    const second = submit(taskId);
    assert.equal(second.version_number, 2);
    assert.equal(getTask(taskId)?.status, "Incelemede");
    assert.ok(listTaskRevisions(taskId)[0]?.completed_at);
    assert.deepEqual(listTaskDeliveries(taskId).map((row) => row.version_number), [2, 1]);
  });

  it("guest kapsamı ve DTO sözleşmesi iç alanları sızdırmaz", () => {
    seedBase();
    const taskId = createGuestTask({
      brandId: "b1",
      accountId: "g1",
      title: "Guest talebi",
      brief: "Kısa brief",
      requestedDate: "2026-08-19",
      attachments: [],
    });
    getDb().prepare("UPDATE tasks SET due_date = '2026-08-21' WHERE id = ?").run(taskId);
    const visible = submit(taskId, true);

    assert.equal(listGuestTaskDeliveries(taskId, "b1").length, 1);
    assert.equal(listGuestTaskDeliveries(taskId, "b2").length, 0);
    assert.throws(() => decideTaskDelivery({
      deliveryId: visible.id,
      decision: "Onaylandi",
      actorKind: "guest",
      actorAccountId: "g2",
      actorName: "İki Marka Guest",
      actorPersonId: null,
      brandId: "b2",
      decisionNote: null,
      revisionReason: null,
      revisionTargetMinutes: null,
    }), /yetkiniz yok/i);

    const dto = getGuestTask(taskId, "b1", "g1");
    assert.ok(dto);
    const serialized = JSON.stringify(dto);
    for (const forbidden of ["due_date", "assignee_id", "weight_points", "submitted_by_account_id", "decision_actor_kind"]) {
      assert.equal(serialized.includes(forbidden), false, forbidden);
    }
  });

  it("team kaynaklı görevin teslimini guest ile paylaşmaz", () => {
    seedBase();
    assert.throws(() => submit(createTeamTask(), true), /yalnızca guest kaynaklı/i);
  });

  it("raporda ilk onay oranını, revize nedenini ve marka kırılımını hesaplar", () => {
    seedBase();
    const approvedTask = createTeamTask();
    const approved = submit(approvedTask);
    decideTaskDelivery({
      deliveryId: approved.id,
      decision: "Onaylandi",
      actorKind: "team",
      actorAccountId: "team:p1",
      actorName: "Ayşe",
      actorPersonId: "p1",
      decisionNote: null,
      revisionReason: null,
      revisionTargetMinutes: null,
    });
    const revisedTask = createTeamTask();
    const revised = submit(revisedTask);
    decideTaskDelivery({
      deliveryId: revised.id,
      decision: "RevizeIstendi",
      actorKind: "team",
      actorAccountId: "team:p1",
      actorName: "Ayşe",
      actorPersonId: "p1",
      decisionNote: "Renk değişmeli.",
      revisionReason: "Tasarim",
      revisionTargetMinutes: 60,
    });

    const report = getDeliveryQualityReport(null);
    assert.equal(report.total_deliveries, 2);
    assert.equal(report.approved_deliveries, 1);
    assert.equal(report.revision_requests, 1);
    assert.equal(report.approval_rate, 50);
    assert.deepEqual(report.reasons, [{ reason: "Tasarim", revision_requests: 1 }]);
    assert.equal(report.brands[0]?.brand_id, "b1");
    assert.equal(report.brands[0]?.approval_rate, 50);
  });
});
