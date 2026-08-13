import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-task-metadata-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const {
  completeTaskRevision,
  createTask,
  getTask,
  listTaskRevisions,
  setTaskArchived,
  startTaskRevision,
  updateTaskDifficulty,
  updateTaskStatus,
} = await import("@/lib/repositories/tasks");
const {
  formatRevisionDuration,
  isRevisionOverTarget,
  matchesTaskMetadataFilters,
} = await import("@/lib/taskMetadata");

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
  db.prepare("INSERT INTO people (id, name) VALUES ('p1', 'Ayşe')").run();
  db.prepare(
    "INSERT INTO content_items (id, brand_id, title, type) VALUES ('c1', 'b1', 'İçerik', 'Reel')",
  ).run();
}

beforeEach(resetDb);
after(resetDb);

describe("görev zorluk derecesi", () => {
  it("eski görevleri uydurma bir değerle doldurmuyor, yeni görevde seçimi saklıyor", () => {
    seedBase();
    const db = getDb();
    db.prepare(
      "INSERT INTO tasks (id, content_item_id, title, due_date) VALUES ('legacy', 'c1', 'Eski görev', '2026-08-20')",
    ).run();
    assert.equal(getTask("legacy")?.difficulty, null);

    const id = createTask({
      contentItemId: "c1",
      title: "Yeni görev",
      assigneeId: "p1",
      dueDate: "2026-08-21",
      difficulty: "Zor",
    });
    assert.equal(getTask(id)?.difficulty, "Zor");

    updateTaskDifficulty(id, "Ozel");
    assert.equal(getTask(id)?.difficulty, "Ozel");
  });
});

describe("revize turları", () => {
  it("tur numarasını artırıyor, aynı anda yalnızca bir aktif tur açıyor ve süreyi kaydediyor", () => {
    seedBase();
    const taskId = createTask({
      contentItemId: "c1",
      title: "Kurgu",
      assigneeId: "p1",
      dueDate: "2026-08-21",
      difficulty: "Orta",
    });

    const first = startTaskRevision({
      taskId,
      targetMinutes: 240,
      note: "Müzik ve ilk plan değişecek.",
      actorId: "p1",
    });
    assert.equal(first.round_number, 1);
    assert.throws(
      () => startTaskRevision({ taskId, targetMinutes: 60, note: null, actorId: "p1" }),
      /aktif bir revize turu/i,
    );
    assert.throws(
      () => updateTaskStatus(taskId, "Yayinlandi", "p1"),
      /aktif revize turu tamamlanmalı/i,
    );
    assert.throws(
      () => setTaskArchived(taskId, true),
      /aktif revize turu tamamlanmalı/i,
    );

    completeTaskRevision(first.id, "p1");
    const second = startTaskRevision({
      taskId,
      targetMinutes: 480,
      note: null,
      actorId: "p1",
    });
    assert.equal(second.round_number, 2);

    const rounds = listTaskRevisions(taskId);
    assert.equal(rounds.length, 2);
    assert.equal(rounds[0]?.completed_at, null);
    assert.ok(rounds[1]?.completed_at);
    assert.equal(getTask(taskId)?.revision_count, 2);
    assert.equal(getTask(taskId)?.active_revision_id, second.id);
  });

  it("tamamlanmış görevde ve arşivde yeni revize başlatmıyor", () => {
    seedBase();
    const taskId = createTask({
      contentItemId: "c1",
      title: "Yayın",
      assigneeId: "p1",
      dueDate: "2026-08-21",
      difficulty: "Kolay",
    });
    const db = getDb();
    db.prepare("UPDATE tasks SET status = 'Yayinlandi' WHERE id = ?").run(taskId);
    assert.throws(
      () => startTaskRevision({ taskId, targetMinutes: 60, note: null, actorId: "p1" }),
      /önce görevi yeniden aç/i,
    );
  });
});

describe("görev metaverisi filtreleri ve süre sunumu", () => {
  const task = {
    due_date: "2026-08-13",
    difficulty: "Zor" as const,
    revision_count: 2,
    active_revision_id: "r2",
    active_revision_elapsed_minutes: 300,
    active_revision_target_minutes: 240,
  };

  it("teslim, zorluk ve revize filtrelerini birlikte uygular", () => {
    assert.equal(
      matchesTaskMetadataFilters(task, {
        due: "today",
        difficulty: "Zor",
        revision: "overdue",
        today: "2026-08-13",
        weekEnd: "2026-08-17",
        dateFrom: "",
        dateTo: "",
      }),
      true,
    );
    assert.equal(
      matchesTaskMetadataFilters(task, {
        due: "week",
        difficulty: "Kolay",
        revision: "active",
        today: "2026-08-13",
        weekEnd: "2026-08-17",
        dateFrom: "",
        dateTo: "",
      }),
      false,
    );
  });

  it("hedef aşımını ve okunabilir süreyi hesaplar", () => {
    assert.equal(isRevisionOverTarget(300, 240), true);
    assert.equal(isRevisionOverTarget(120, null), false);
    assert.equal(formatRevisionDuration(75), "1 sa 15 dk");
    assert.equal(formatRevisionDuration(1_500), "1 gün 1 sa");
  });
});
