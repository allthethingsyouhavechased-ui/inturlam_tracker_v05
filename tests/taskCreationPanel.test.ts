import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-task-creation-panel-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const { resolveTaskCreationWeight } = await import("@/lib/progress");
const { createTask, getTask } = await import("@/lib/repositories/tasks");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(TMP_DB + suffix, { force: true });
  }
}

function seedBase(): void {
  const db = getDb();
  db.prepare("INSERT INTO brands (id, name, cluster) VALUES ('b1', 'Marka', 'tek')").run();
  db.prepare(
    "INSERT INTO content_items (id, brand_id, title, type) VALUES ('c1', 'b1', 'Reel işi', 'Reel')",
  ).run();
}

beforeEach(resetDb);
after(resetDb);

describe("görev oluşturma puanı", () => {
  it("yöneticinin 1-100 arası puanını kabul eder, yetkisiz değişikliği reddeder", () => {
    assert.equal(resolveTaskCreationWeight("8", true, "Orta"), 8);
    assert.equal(resolveTaskCreationWeight(null, false, "Kolay"), 1);
    assert.equal(resolveTaskCreationWeight(null, false, "Orta"), 2);
    assert.equal(resolveTaskCreationWeight(null, false, "Zor"), 3);
    assert.equal(resolveTaskCreationWeight(null, false, "Ozel"), 5);
    assert.throws(() => resolveTaskCreationWeight("8", false, "Orta"), /yalnızca yöneticiler/i);
    assert.throws(() => resolveTaskCreationWeight("0", true, "Orta"), /1 ile 100/i);
    assert.throws(() => resolveTaskCreationWeight("1.5", true, "Orta"), /tam sayı/i);
  });

  it("seçilen ağırlığı yazar, boşsa zorluk varsayılanını kullanır", () => {
    seedBase();
    const weightedId = createTask({
      contentItemId: "c1",
      title: "Zor kurgu",
      assigneeId: null,
      dueDate: "2026-08-20",
      contentType: "Reel",
      weightPoints: 8,
    });
    const defaultId = createTask({
      contentItemId: "c1",
      title: "Standart kurgu",
      assigneeId: null,
      dueDate: "2026-08-21",
      contentType: "Reel",
    });

    assert.equal(getTask(weightedId)?.weight_points, 8);
    assert.equal(getTask(defaultId)?.weight_points, 2);
    assert.throws(() => createTask({
      contentItemId: "c1",
      title: "Geçersiz",
      assigneeId: null,
      dueDate: "2026-08-22",
      contentType: "Reel",
      weightPoints: 101,
    }), /1 ile 100/i);
  });
});

describe("görev oluşturma paneli sözleşmesi", () => {
  it("puan alanını yöneticiye açar ve sunucuya taşır", () => {
    const quick = fs.readFileSync(path.join(process.cwd(), "components", "QuickAddModal.tsx"), "utf8");
    const header = fs.readFileSync(path.join(process.cwd(), "components", "Header.tsx"), "utf8");
    const contentForm = fs.readFileSync(path.join(process.cwd(), "components", "NewTaskForm.tsx"), "utf8");
    const action = fs.readFileSync(path.join(process.cwd(), "lib", "actions", "tasks.ts"), "utf8");

    assert.match(quick, /canSetWeight/);
    assert.match(quick, /name="weightPoints"/);
    assert.match(quick, /Object\.entries\(\{[\s\S]*?difficulty, weightPoints, assigneeId/);
    assert.match(quick, /data\.set\(name, value\)/);
    assert.match(quick, /quickCreateTaskAction\(data\)/);
    const quickRepository = fs.readFileSync(path.join(process.cwd(), "lib", "repositories", "quickCreate.ts"), "utf8");
    assert.match(quickRepository, /resolveTaskCreationWeight\(values\.weightPoints, actor\.is_manager === 1, values\.difficulty/);
    assert.match(header, /canSetWeight=\{person\.is_manager === 1\}/);
    assert.match(contentForm, /name="weightPoints"/);
    assert.match(action, /resolveTaskCreationWeight/);
  });
});
