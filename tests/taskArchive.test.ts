// "Yayınlandı" görevler panodan ANINDA düşmemeli, bir süre sonra arşive
// gitmeli. Buradaki testler tam olarak o iki ucu kilitliyor: yeni yayınlanan iş
// listelerde KALIYOR mu, süresi dolan iş gerçekten düşüyor mu, ve arşivlenmiş
// bir iş yeniden açılınca geri geliyor mu.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-archive-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const {
  listAllTasks,
  listArchivedTasksByContent,
  listBoardTasksByAssignee,
  listOpenTasksByBrand,
  listTasksByContent,
  setTaskArchived,
  sweepArchivablePublishedTasks,
  updateTaskStatus,
} = await import("@/lib/repositories/tasks");
const {
  ARCHIVE_AFTER_DAYS,
  archiveCountdownBadge,
  daysSinceCompletion,
  daysUntilArchive,
  shouldAutoArchive,
} = await import("@/lib/taskArchive");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(TMP_DB + suffix, { force: true });
  }
}

function seedBase(db: DatabaseSync): void {
  db.prepare("INSERT INTO brands (id, name, cluster) VALUES ('b1', 'Marka', 'tek')").run();
  db.prepare("INSERT INTO people (id, name) VALUES ('p1', 'Ayşe')").run();
  db.prepare(
    "INSERT INTO content_items (id, brand_id, title, type) VALUES ('c1', 'b1', 'İçerik', 'Reel')",
  ).run();
}

// `completed_at`'i bugüne göre GÖRELİ yazıyoruz: test sabit bir tarihe
// bağlanmasın, süpürme SQL'i `julianday('now')` kullandığı için de gerçek
// zamanla karşılaştırılsın.
function insertTask(
  db: DatabaseSync,
  id: string,
  status: string,
  completedDaysAgo: number | null,
): void {
  // `completedDaysAgo` testten gelen bir sayı; SQL'e gömmek güvenli ve
  // `datetime('now', ?)` bağlamaktan okunaklı.
  const completedAt =
    completedDaysAgo === null ? "NULL" : `datetime('now', '-${completedDaysAgo} day')`;
  db.prepare(
    `INSERT INTO tasks (id, content_item_id, title, status, assignee_id, completed_at)
     VALUES (?, 'c1', ?, ?, 'p1', ${completedAt})`,
  ).run(id, `Görev ${id}`, status);
}

beforeEach(resetDb);
after(resetDb);

describe("arşiv kuralı (saf yardımcılar)", () => {
  const now = new Date("2026-08-10T12:00:00Z");

  it("tamamlanmadan geçen tam günleri sayıyor", () => {
    assert.equal(daysSinceCompletion("2026-08-10 12:00:00", now), 0);
    assert.equal(daysSinceCompletion("2026-08-07 12:00:00", now), 3);
    // Bilinmeyen/bozuk damga erken arşivlemeye yol açmamalı.
    assert.equal(daysSinceCompletion(null, now), 0);
    assert.equal(daysSinceCompletion("bozuk-damga", now), 0);
  });

  it("yalnızca süresi dolmuş, yayınlanmış ve arşivsiz görevleri seçiyor", () => {
    const published = (completedAt: string | null, archivedAt: string | null = null) => ({
      status: "Yayinlandi",
      completed_at: completedAt,
      archived_at: archivedAt,
    });

    assert.equal(shouldAutoArchive(published("2026-08-01 12:00:00"), now), true);
    assert.equal(shouldAutoArchive(published("2026-08-09 12:00:00"), now), false);
    assert.equal(
      shouldAutoArchive(published("2026-08-01 12:00:00", "2026-08-08 00:00:00"), now),
      false,
      "zaten arşivlenmiş görev tekrar damgalanmamalı",
    );
    assert.equal(
      shouldAutoArchive(
        { status: "Incelemede", completed_at: "2026-08-01 12:00:00", archived_at: null },
        now,
      ),
      false,
      "açık görev asla otomatik arşivlenmez",
    );
  });

  it("kalan gün sayısını 0'ın altına düşürmüyor", () => {
    assert.equal(daysUntilArchive("2026-08-10 12:00:00", now), ARCHIVE_AFTER_DAYS);
    assert.equal(daysUntilArchive("2026-08-08 12:00:00", now), ARCHIVE_AFTER_DAYS - 2);
    assert.equal(daysUntilArchive("2026-06-01 12:00:00", now), 0);
  });

  it("geri sayım rozetini yalnızca panoda duran yayınlanmış kartlara veriyor", () => {
    const badge = archiveCountdownBadge(
      { status: "Yayinlandi", completed_at: "2026-08-08 12:00:00", archived_at: null },
      now,
    );
    assert.equal(badge?.label, `⏳ ${ARCHIVE_AFTER_DAYS - 2} gün sonra arşiv`);

    assert.equal(
      archiveCountdownBadge(
        { status: "Yayinlandi", completed_at: "2026-08-03 12:00:00", archived_at: null },
        now,
      )?.label,
      "⏳ Arşive gidiyor",
      "süresi dolmuş ama henüz süpürülmemiş kart 0 gün göstermeli",
    );

    // Açık iş ve zaten arşivlenmiş iş rozet almaz — biri henüz bitmedi,
    // diğeri panoda zaten görünmüyor.
    assert.equal(
      archiveCountdownBadge(
        { status: "DevamEdiyor", completed_at: null, archived_at: null },
        now,
      ),
      null,
    );
    assert.equal(
      archiveCountdownBadge(
        {
          status: "Yayinlandi",
          completed_at: "2026-08-01 12:00:00",
          archived_at: "2026-08-08 00:00:00",
        },
        now,
      ),
      null,
    );
  });
});

describe("yayınlanan görev panoda kalır", () => {
  it("marka çalışma alanına yalnızca sınırlı sayıdaki açık işi getirir", () => {
    const db = getDb();
    seedBase(db);
    db.prepare("INSERT INTO brands (id, name, cluster) VALUES ('b2', 'Diğer', 'tek')").run();
    db.prepare(
      "INSERT INTO content_items (id, brand_id, title, type) VALUES ('c2', 'b2', 'Diğer içerik', 'Post')",
    ).run();

    for (let index = 0; index < 7; index += 1) {
      db.prepare(
        `INSERT INTO tasks (id, content_item_id, title, status, due_date)
         VALUES (?, 'c1', ?, 'Beklemede', ?)`,
      ).run(`acik-${index}`, `Açık ${index}`, `2026-09-${String(index + 1).padStart(2, "0")}`);
    }
    db.prepare(
      "INSERT INTO tasks (id, content_item_id, title, status) VALUES ('yayin', 'c1', 'Yayın', 'Yayinlandi')",
    ).run();
    db.prepare(
      "INSERT INTO tasks (id, content_item_id, title, status, archived_at) VALUES ('arsiv', 'c1', 'Arşiv', 'Beklemede', datetime('now'))",
    ).run();
    db.prepare(
      "INSERT INTO tasks (id, content_item_id, title, status, origin) VALUES ('plansiz', 'c1', 'Plansız', 'Beklemede', 'guest')",
    ).run();
    db.prepare(
      "INSERT INTO tasks (id, content_item_id, title, status) VALUES ('diger', 'c2', 'Diğer marka', 'Beklemede')",
    ).run();

    const tasks = listOpenTasksByBrand("b1", 5);
    assert.equal(tasks.length, 5);
    assert.deepEqual(tasks.map((task) => task.id), ["acik-0", "acik-1", "acik-2", "acik-3", "acik-4"]);
  });

  it("yeni yayınlanan iş listelerden DÜŞMEZ, süresi dolan düşer", () => {
    const db = getDb();
    seedBase(db);
    insertTask(db, "taze", "Yayinlandi", 1);
    insertTask(db, "eski", "Yayinlandi", ARCHIVE_AFTER_DAYS + 1);
    insertTask(db, "acik", "DevamEdiyor", null);

    // Süpürmeden önce hepsi görünür — "yayınlandı" tek başına gizlemiyor.
    assert.deepEqual(
      listAllTasks().map((task) => task.id).sort(),
      ["acik", "eski", "taze"],
    );

    assert.equal(sweepArchivablePublishedTasks(), 1, "yalnızca süresi dolan arşivlenmeli");

    assert.deepEqual(listAllTasks().map((task) => task.id).sort(), ["acik", "taze"]);
    assert.deepEqual(listTasksByContent("c1").map((task) => task.id).sort(), ["acik", "taze"]);
    assert.deepEqual(
      listBoardTasksByAssignee("p1").map((task) => task.id).sort(),
      ["acik", "taze"],
      "Panom board'u yayınlananı da göstermeli — kart geri sürüklenebilsin",
    );

    // Arşiv silinmedi: hem içerik sayfasının arşiv bölümünde hem de
    // "arşiv dahil" listelemesinde okunabilir.
    assert.deepEqual(listArchivedTasksByContent("c1").map((task) => task.id), ["eski"]);
    assert.deepEqual(
      listAllTasks(true).map((task) => task.id).sort(),
      ["acik", "eski", "taze"],
    );

    // İkinci süpürme aynı satıra tekrar dokunmamalı (idempotent).
    assert.equal(sweepArchivablePublishedTasks(), 0);
  });

  it("durum değişikliği arşiv damgasını siliyor", () => {
    const db = getDb();
    seedBase(db);
    insertTask(db, "t1", "Yayinlandi", ARCHIVE_AFTER_DAYS + 3);
    sweepArchivablePublishedTasks();
    assert.equal(listAllTasks().length, 0);

    // Yanlışlıkla yayınlandı işaretlenip arşive düşen iş, durumu geri
    // alındığında panoya dönmeli — yoksa görünmez bir görev olarak kalırdı.
    updateTaskStatus("t1", "DevamEdiyor", "p1");
    const [task] = listAllTasks();
    assert.equal(task?.id, "t1");
    assert.equal(task?.archived_at, null);

    // Yeniden yayınlamak da hemen arşive atmamalı: sayaç baştan başlar.
    updateTaskStatus("t1", "Yayinlandi", "p1");
    assert.equal(sweepArchivablePublishedTasks(), 0);
    assert.equal(listAllTasks().length, 1);
  });

  it("elle arşivleme ve geri alma durumu değiştirmiyor", () => {
    const db = getDb();
    seedBase(db);
    insertTask(db, "t1", "Yayinlandi", 0);

    setTaskArchived("t1", true);
    assert.equal(listAllTasks().length, 0);
    assert.equal(listAllTasks(true)[0]?.status, "Yayinlandi");

    setTaskArchived("t1", false);
    assert.equal(listAllTasks()[0]?.id, "t1");
    assert.equal(listAllTasks()[0]?.archived_at, null);
  });
});

describe("arşiv migrationı", () => {
  it("archived_at sütunu olmayan eski DB'ye sütunu ekliyor, veriyi bozmuyor", () => {
    const legacy = new DatabaseSync(TMP_DB);
    legacy.exec(`
      CREATE TABLE brands (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, cluster TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0, archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE people (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE content_items (
        id TEXT PRIMARY KEY,
        brand_id TEXT NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('Reel','Foto','Kampanya','Video','Carousel','KurumsalKimlik','Diger')),
        target_date TEXT,
        status TEXT NOT NULL DEFAULT 'Planlandi' CHECK (status IN ('Planlandi','Uretimde','Tamamlandi','IptalEdildi')),
        assignee_id TEXT REFERENCES people(id) ON DELETE SET NULL,
        archived INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE tasks (
        id TEXT PRIMARY KEY,
        content_item_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Beklemede' CHECK (status IN ('Beklemede','DevamEdiyor','Incelemede','Onaylandi','Yayinlandi')),
        priority TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('Dusuk','Normal','Yuksek','Acil')),
        assignee_id TEXT REFERENCES people(id) ON DELETE SET NULL,
        due_date TEXT,
        notes TEXT,
        repeat_days INTEGER,
        completed_at TEXT,
        completed_by TEXT REFERENCES people(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      INSERT INTO brands (id, name, cluster) VALUES ('b1', 'Marka', 'tek');
      INSERT INTO people (id, name) VALUES ('p1', 'Ayşe');
      INSERT INTO content_items (id, brand_id, title, type) VALUES ('c1', 'b1', 'İçerik', 'Reel');
      INSERT INTO tasks (id, content_item_id, title, status, assignee_id, completed_at)
        VALUES ('t1', 'c1', 'Eski yayın', 'Yayinlandi', 'p1', '2026-01-05 12:00:00');
    `);
    legacy.close();

    const db = getDb();
    const columns = db.prepare("PRAGMA table_info(tasks)").all() as { name: string }[];
    assert.ok(columns.some((column) => column.name === "archived_at"));

    // Migration geri doldurma YAPMIYOR; kural tek yerde (süpürme) kalsın.
    const row = db
      .prepare("SELECT title, status, archived_at FROM tasks WHERE id = 't1'")
      .get() as { title: string; status: string; archived_at: string | null };
    assert.deepEqual({ ...row }, {
      title: "Eski yayın",
      status: "Yayinlandi",
      archived_at: null,
    });

    // Ama ilk süpürmede çok eski bir yayın arşive düşmeli.
    assert.equal(sweepArchivablePublishedTasks(), 1);
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  });
});
