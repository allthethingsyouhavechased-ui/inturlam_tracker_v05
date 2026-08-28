import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-active-work-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const {
  listActiveWorkSelections,
  listPersonTaskPreviews,
  listPersonTaskWorkSummaries,
  setPersonActiveBrand,
} =
  await import("@/lib/repositories/activeWork");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(TMP_DB + suffix, { force: true });
  }
}

function seedBase(): void {
  const db = getDb();
  db.prepare("INSERT INTO people (id, name) VALUES ('p1', 'Ayşe')").run();
  db.prepare("INSERT INTO people (id, name) VALUES ('p2', 'Bora')").run();
  db.prepare(
    "INSERT INTO brands (id, name, cluster, archived) VALUES ('b1', 'Marka Bir', 'tek', 0)",
  ).run();
  db.prepare(
    "INSERT INTO brands (id, name, cluster, archived) VALUES ('b2', 'Marka İki', 'tek', 0)",
  ).run();
  db.prepare(
    "INSERT INTO brands (id, name, cluster, archived) VALUES ('b3', 'Arşiv Marka', 'tek', 1)",
  ).run();
}

beforeEach(() => {
  resetDb();
  seedBase();
});
after(resetDb);

describe("aktif marka kanbanı", () => {
  it("kişi başına tek marka tutuyor ve yeni seçim eskisini değiştiriyor", () => {
    setPersonActiveBrand("p1", "b1");
    assert.deepEqual(
      listActiveWorkSelections().map(({ person_id, brand_id, brand_name }) => ({
        person_id,
        brand_id,
        brand_name,
      })),
      [{ person_id: "p1", brand_id: "b1", brand_name: "Marka Bir" }],
    );

    setPersonActiveBrand("p1", "b2");
    const selections = listActiveWorkSelections();
    assert.equal(selections.length, 1);
    assert.equal(selections[0].brand_id, "b2");
  });

  it("müsait seçimi kaydı kaldırıyor", () => {
    setPersonActiveBrand("p1", "b1");
    setPersonActiveBrand("p1", null);
    assert.deepEqual(listActiveWorkSelections(), []);
  });

  it("arşivlenmiş marka aktif çalışma olarak seçilemiyor", () => {
    assert.throws(
      () => setPersonActiveBrand("p1", "b3"),
      /bulunamadı veya arşivlenmiş/,
    );
  });
});

describe("ekip iş yükü özeti", () => {
  function seedTask(
    id: string,
    status: string,
    dueDate: string | null,
    options: { archived?: boolean; origin?: "team" | "guest" } = {},
  ): void {
    const db = getDb();
    db.prepare(
      `INSERT OR IGNORE INTO content_items (id, brand_id, title, type)
       VALUES ('c1', 'b1', 'İçerik', 'Post')`,
    ).run();
    db.prepare(
      `INSERT INTO tasks
         (id, content_item_id, title, status, assignee_id, due_date, origin, archived_at)
       VALUES (?, 'c1', ?, ?, 'p1', ?, ?, ?)`,
    ).run(
      id,
      `Görev ${id}`,
      status,
      dueDate,
      options.origin ?? "team",
      options.archived ? "2026-08-01 10:00:00" : null,
    );
  }

  it("aktif marka seçimi olmasa da yalnızca operasyonel açık işleri sayıyor", () => {
    seedTask("t1", "Beklemede", "2026-08-20");
    seedTask("t2", "DevamEdiyor", "2026-08-28");
    seedTask("t3", "Yayinlandi", "2026-08-18");
    seedTask("t4", "Beklemede", "2026-08-19", { archived: true });
    seedTask("t5", "Beklemede", null, { origin: "guest" });

    assert.deepEqual(listPersonTaskWorkSummaries("2026-08-27"), [
      { person_id: "p1", open_count: 2, overdue_count: 1 },
      { person_id: "p2", open_count: 0, overdue_count: 0 },
    ]);
  });

  it("kişi başına en yakın iki açık görevin dar önizlemesini döndürüyor", () => {
    seedTask("t3", "Beklemede", "2026-08-30");
    seedTask("t1", "Beklemede", "2026-08-20");
    seedTask("t2", "Beklemede", "2026-08-28");

    assert.deepEqual(
      listPersonTaskPreviews().map((task) => task.task_id),
      ["t1", "t2"],
    );
  });
});
