import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-task-quick-revision-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const { createTaskDelivery } = await import("@/lib/repositories/deliveries");
const { createTask, getTask } = await import("@/lib/repositories/tasks");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(TMP_DB + suffix, { force: true });
  }
}

beforeEach(resetDb);
after(resetDb);

describe("liste ve karttan hızlı revize", () => {
  it("görev sorgusu bekleyen teslim kimliğini ve sürümünü taşır", () => {
    const db = getDb();
    db.prepare("INSERT INTO brands (id, name, cluster) VALUES ('b1', 'Marka', 'tek')").run();
    db.prepare("INSERT INTO people (id, name) VALUES ('p1', 'Ayşe')").run();
    db.prepare("INSERT INTO accounts (id, kind, person_id) VALUES ('team:p1', 'team', 'p1')").run();
    db.prepare(
      "INSERT INTO content_items (id, brand_id, title, type) VALUES ('c1', 'b1', 'Reel işi', 'Reel')",
    ).run();
    const taskId = createTask({
      contentItemId: "c1",
      title: "Kurgu",
      assigneeId: "p1",
      dueDate: "2026-08-20",
      contentType: "Reel",
    });
    const delivery = createTaskDelivery({
      taskId,
      note: "V1",
      externalUrl: null,
      guestVisible: false,
      submittedByAccountId: "team:p1",
      submittedByName: "Ayşe",
      submittedByPersonId: "p1",
    }, []);

    const task = getTask(taskId);
    assert.equal(task?.status, "Incelemede");
    assert.equal(task?.pending_delivery_id, delivery.id);
    assert.equal(task?.pending_delivery_version, 1);
  });

  it("kart ve liste aynı teslim-kararı bileşenini gösterir", () => {
    const card = fs.readFileSync(path.join(process.cwd(), "components", "TaskGridCard.tsx"), "utf8");
    const list = fs.readFileSync(path.join(process.cwd(), "components", "TaskListView.tsx"), "utf8");
    const dialog = fs.readFileSync(path.join(process.cwd(), "components", "TaskQuickRevisionDialog.tsx"), "utf8");

    assert.match(card, /<TaskQuickRevisionDialog/);
    assert.match(list, /<TaskQuickRevisionDialog/);
    assert.match(dialog, /decideTeamTaskDeliveryAction/);
    assert.match(dialog, /name="decision" value="RevizeIstendi"/);
    assert.match(dialog, /name="revisionReason" required/);
    assert.match(dialog, /name="revisionTargetMinutes" required/);
    assert.match(dialog, /name="decisionNote"\s+required/);
  });
});
