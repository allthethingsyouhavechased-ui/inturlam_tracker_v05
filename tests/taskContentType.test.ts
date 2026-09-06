import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-task-content-type-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const { createTask, getTask, updateTaskDetails } = await import("@/lib/repositories/tasks");

const SCHEMA_SQL = fs.readFileSync(
  path.join(process.cwd(), "lib", "db", "schema.sql"),
  "utf8",
);

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
    "INSERT INTO content_items (id, brand_id, title, type) VALUES ('c1', 'b1', 'Foto çalışması', 'Foto')",
  ).run();
}

beforeEach(resetDb);
after(resetDb);

describe("göreve özel içerik türü", () => {
  it("aynı çalışma altındaki görevlerin türünü birbirinden bağımsız saklar ve düzenler", () => {
    seedBase();
    const reelTaskId = createTask({
      contentItemId: "c1",
      title: "Reels kurgusu",
      assigneeId: null,
      dueDate: "2026-08-20",
      contentType: "Reel",
    });
    const inheritedTaskId = createTask({
      contentItemId: "c1",
      title: "Eski foto görevi",
      assigneeId: null,
      dueDate: "2026-08-21",
    });

    assert.equal(getTask(reelTaskId)?.content_type, "Reel");
    assert.equal(getTask(inheritedTaskId)?.content_type, "Foto");

    updateTaskDetails({
      id: reelTaskId,
      title: "Video kurgusu",
      contentType: "Video",
      dueDate: "2026-08-20",
      notes: null,
    });

    assert.equal(getTask(reelTaskId)?.content_type, "Video");
    assert.equal(getTask(inheritedTaskId)?.content_type, "Foto");
    assert.equal(
      (getDb().prepare("SELECT type FROM content_items WHERE id = 'c1'").get() as { type: string }).type,
      "Foto",
      "tek görev türü değişince bağlı çalışmanın ve kardeş görevlerin türü değişmemeli",
    );
  });

  it("eski şemaya tür sütununu ekler ve mevcut görevin görünen türünü korur", () => {
    const legacySchema = SCHEMA_SQL.replace(
      /  type_override\s+TEXT CHECK \(type_override IN \('Reel','Post','Story','Foto','Kampanya','Video','Carousel','KurumsalKimlik','Diger'\)\),\r?\n/,
      "",
    );
    assert.notEqual(legacySchema, SCHEMA_SQL, "test görev türü sütunu olmayan eski şemayı üretmeli");

    const legacy = new DatabaseSync(TMP_DB);
    legacy.exec("PRAGMA foreign_keys = ON");
    legacy.exec(legacySchema);
    legacy.prepare("INSERT INTO brands (id, name, cluster) VALUES ('b1', 'Marka', 'tek')").run();
    legacy.prepare(
      "INSERT INTO content_items (id, brand_id, title, type) VALUES ('c1', 'b1', 'Mevcut iş', 'Reel')",
    ).run();
    legacy.prepare(
      "INSERT INTO tasks (id, content_item_id, title, due_date) VALUES ('t1', 'c1', 'Mevcut görev', '2026-08-20')",
    ).run();
    legacy.close();

    const task = getTask("t1");
    assert.equal(task?.content_type, "Reel");
    assert.equal(task?.type_override, "Reel");
    assert.deepEqual(getDb().prepare("PRAGMA foreign_key_check").all(), []);
  });
});

describe("görev türü arayüz sözleşmesi", () => {
  it("hızlı ekleme, içerik içi ekleme ve görev düzenleme tür alanını taşır", () => {
    const quickAdd = fs.readFileSync(path.join(process.cwd(), "components", "QuickAddModal.tsx"), "utf8");
    const newTask = fs.readFileSync(path.join(process.cwd(), "components", "NewTaskForm.tsx"), "utf8");
    const detail = fs.readFileSync(path.join(process.cwd(), "app", "tasks", "[taskId]", "page.tsx"), "utf8");
    const actions = fs.readFileSync(path.join(process.cwd(), "lib", "actions", "tasks.ts"), "utf8");

    // Content and task now travel in one atomic request; preserve the type
    // mapping and the server-side creation boundary, not the old fd2 variable.
    assert.match(quickAdd, /Object\.entries\(\{[\s\S]*?contentType: taskType/);
    assert.match(quickAdd, /data\.set\(name, value\)/);
    assert.match(quickAdd, /quickCreateTaskAction\(data\)/);
    assert.match(newTask, /name="contentType"/);
    assert.match(detail, /name="contentType"/);
    assert.match(actions, /CONTENT_TYPES\.includes\(contentType\)/);
  });
});
