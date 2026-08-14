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
    assert.equal(resolveTaskCreationWeight("8", true), 8);
    assert.equal(resolveTaskCreationWeight(null, false), 1);
    assert.throws(() => resolveTaskCreationWeight("8", false), /yalnızca yöneticiler/i);
    assert.throws(() => resolveTaskCreationWeight("0", true), /1 ile 100/i);
    assert.throws(() => resolveTaskCreationWeight("1.5", true), /tam sayı/i);
  });

  it("seçilen ağırlığı yeni görev kaydına yazar ve varsayılanı 1 tutar", () => {
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
    assert.equal(getTask(defaultId)?.weight_points, 1);
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
    assert.match(quick, /fd2\.set\("weightPoints", weightPoints\)/);
    assert.doesNotMatch(quick, /lg:grid-cols-4/);
    assert.match(header, /canSetWeight=\{person\.is_manager === 1\}/);
    assert.match(contentForm, /name="weightPoints"/);
    assert.match(action, /resolveTaskCreationWeight/);
  });
});
