// Paket hak edişi: puan YALNIZ bütünü teslim edilip ekipçe onaylanmış
// paketten doğar. 3/4 onay = 0 puan; 4/4 = tam tutar. Hak ediş ayı, paketi
// tamamlayan SON ekip onayının İstanbul takvim ayıdır.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-point-packages-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const { changeTaskStatuses } = await import("@/lib/taskLifecycle");
const { createTask } = await import("@/lib/repositories/tasks");
const { createPointPackage, getPointPackage, packageScopeKey, settlePackage } =
  await import("@/lib/repositories/pointPackages");
const { getPersonPointSummary, listLedgerForPerson, recordExtraPoint, recordManagerPoint, reversePointEntry } =
  await import("@/lib/repositories/pointLedger");
const { currentCatalogVersion, assignPersonPointProfile, personProfileForMonth } =
  await import("@/lib/repositories/pointCatalog");
const { unitsToPoints } = await import("@/lib/points/units");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true });
}

function seed(): void {
  const db = getDb();
  db.prepare("INSERT INTO brands (id, name, cluster) VALUES ('b1','Marka','tek')").run();
  db.prepare("INSERT INTO people (id, name, is_manager) VALUES ('mgr','Yönetici',1)").run();
  db.prepare("INSERT INTO people (id, name) VALUES ('ada','Ada')").run();
  db.prepare("INSERT INTO content_items (id, brand_id, title, type) VALUES ('c1','b1','İçerik','Reel')").run();
}

function makeTasks(count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    createTask({
      contentItemId: "c1",
      title: `Reels ${index + 1}`,
      assigneeId: "ada",
      dueDate: "2026-09-20",
    }),
  );
}

/** Video Reels paketi: 4 iş, 320 birim = 16 puan. */
function videoReelsPackage(taskIds: string[]): string {
  return createPointPackage({
    profile: "video",
    scope: "brand",
    brandId: "b1",
    personId: "ada",
    planMonth: "2026-09",
    itemKey: "video.reels",
    catalogVersionId: currentCatalogVersion()!.id,
    requiredCount: 4,
    amountUnits: 320,
    taskIds,
    createdBy: "mgr",
  });
}

/** Ekip onayı: teslim akışını kısa devre etmeden doğrudan durum değişimi. */
function teamApprove(taskId: string): void {
  changeTaskStatuses([taskId], "Onaylandi", "mgr");
}

beforeEach(() => { resetDb(); seed(); });
after(resetDb);

describe("paket tamamlanmadan puan yok", () => {
  it("4 Reels paketinde 3/4 onay 0 puan, 4/4 onay 16 puan", () => {
    const tasks = makeTasks(4);
    const packageId = videoReelsPackage(tasks);

    for (const taskId of tasks.slice(0, 3)) teamApprove(taskId);
    assert.equal(getPersonPointSummary("ada", "2026-09")?.total_units, 0, "3/4 onayda puan doğmamalı");
    assert.equal(getPointPackage(packageId)?.status, "Acik");

    teamApprove(tasks[3]);
    const summary = getPersonPointSummary("ada", "2026-09")!;
    assert.equal(summary.total_units, 320);
    assert.equal(unitsToPoints(summary.total_units), 16);
    assert.equal(summary.base_units, 320);
    assert.equal(getPointPackage(packageId)?.status, "Tamamlandi");
  });

  it("15 fotoğraflık pakette 14/15 = 0, 15/15 = tam 3 puan", () => {
    const tasks = makeTasks(15);
    createPointPackage({
      profile: "video", scope: "brand", brandId: "b1", personId: "ada",
      planMonth: "2026-09", itemKey: "photo_edit",
      catalogVersionId: currentCatalogVersion()!.id,
      requiredCount: 15, amountUnits: 60, taskIds: tasks, createdBy: "mgr",
    });
    for (const taskId of tasks.slice(0, 14)) teamApprove(taskId);
    assert.equal(getPersonPointSummary("ada", "2026-09")?.total_units, 0);
    teamApprove(tasks[14]);
    assert.equal(unitsToPoints(getPersonPointSummary("ada", "2026-09")!.total_units), 3);
  });

  it("tekrar onay çift puan yazmıyor", () => {
    const tasks = makeTasks(4);
    videoReelsPackage(tasks);
    for (const taskId of tasks) teamApprove(taskId);
    // Aynı görevi tekrar onaya almak (durum zaten Onaylandi) hiçbir şey yazmaz.
    changeTaskStatuses(tasks, "Onaylandi", "mgr");
    assert.equal(getPersonPointSummary("ada", "2026-09")?.total_units, 320);
    assert.equal(listLedgerForPerson("ada", "2026-09").length, 1);
  });

  it("aynı kapsam için ikinci paket açılamıyor", () => {
    const tasks = makeTasks(4);
    videoReelsPackage(tasks);
    assert.throws(() => videoReelsPackage(makeTasks(4)), /zaten bir puan paketi var/);
  });
});

describe("hak ediş ayı ve tersleme", () => {
  it("son ekip onayının ayına yazılıyor (Eylül'de 3, Ekim'de son iş)", () => {
    const tasks = makeTasks(4);
    const packageId = videoReelsPackage(tasks);
    const db = getDb();
    // Onay damgalarını doğrudan kuruyoruz: hak ediş ayı kuralını, gerçek
    // saatin hangi ayda olduğundan bağımsız test edebilmek için.
    const approve = db.prepare(
      `INSERT INTO task_status_events (id, task_id, from_status, to_status, actor_id, created_at)
       VALUES (?, ?, 'DevamEdiyor', 'Onaylandi', 'mgr', ?)`,
    );
    const setStatus = db.prepare("UPDATE tasks SET status = 'Onaylandi' WHERE id = ?");
    tasks.slice(0, 3).forEach((taskId, index) => {
      setStatus.run(taskId);
      approve.run(crypto.randomUUID(), taskId, `2026-09-2${index} 10:00:00`);
    });
    settlePackage(db, packageId);
    assert.equal(getPersonPointSummary("ada", "2026-09")?.total_units, 0, "3/4 onayda puan yok");

    setStatus.run(tasks[3]);
    approve.run(crypto.randomUUID(), tasks[3], "2026-10-02 09:00:00");
    settlePackage(db, packageId);

    assert.equal(getPointPackage(packageId)?.status, "Tamamlandi");
    assert.equal(getPersonPointSummary("ada", "2026-09")?.total_units, 0, "plan ayına yazılmamalı");
    assert.equal(getPersonPointSummary("ada", "2026-10")?.total_units, 320, "hak ediş Ekim'e yazılmalı");
  });

  it("ay sınırındaki gece yarısı onayı İstanbul takvimine göre yazılıyor", () => {
    const tasks = makeTasks(4);
    const packageId = videoReelsPackage(tasks);
    const db = getDb();
    const approve = db.prepare(
      `INSERT INTO task_status_events (id, task_id, from_status, to_status, actor_id, created_at)
       VALUES (?, ?, 'DevamEdiyor', 'Onaylandi', 'mgr', ?)`,
    );
    db.prepare("UPDATE tasks SET status = 'Onaylandi'").run();
    tasks.slice(0, 3).forEach((taskId) => approve.run(crypto.randomUUID(), taskId, "2026-09-30 12:00:00"));
    // 30 Eylül 22:30 UTC = 1 Ekim 01:30 TSİ → hak ediş EKİM'e yazılmalı.
    approve.run(crypto.randomUUID(), tasks[3], "2026-09-30 22:30:00");
    settlePackage(db, packageId);

    assert.equal(getPersonPointSummary("ada", "2026-09")?.total_units, 0);
    assert.equal(getPersonPointSummary("ada", "2026-10")?.total_units, 320);
  });

  it("üyenin onayı düşerse hak ediş terslenip net sıfırlanıyor", () => {
    const tasks = makeTasks(4);
    videoReelsPackage(tasks);
    for (const taskId of tasks) teamApprove(taskId);
    const period = listLedgerForPerson("ada", "2026-09")[0]?.period;
    assert.equal(period, "2026-09");

    changeTaskStatuses([tasks[0]], "DevamEdiyor", "mgr");
    const summary = getPersonPointSummary("ada", period!)!;
    assert.equal(summary.total_units, 0, "ters kayıt net toplamı sıfırlamalı");
    assert.equal(summary.base_units, 320);
    assert.equal(summary.correction_units, -320);
    // Kayıt SİLİNMİYOR: hem hak ediş hem ters kayıt duruyor.
    assert.equal(listLedgerForPerson("ada", period!).length, 2);
  });

  it("paket yeniden tamamlanınca tek net hak ediş kalıyor", () => {
    const tasks = makeTasks(4);
    videoReelsPackage(tasks);
    for (const taskId of tasks) teamApprove(taskId);
    changeTaskStatuses([tasks[0]], "DevamEdiyor", "mgr");
    teamApprove(tasks[0]);
    const summary = getPersonPointSummary("ada", "2026-09")!;
    assert.equal(summary.total_units, 320, "net toplam tek hak ediş olmalı");
  });
});

describe("ek puanlar ve yönetici puanı", () => {
  it("çekim kişi + gün başına tek kez yazılıyor", () => {
    recordExtraPoint({
      personId: "ada", itemKey: "shoot", referenceId: "ignored",
      occurredAt: "2026-09-10T08:00:00Z", reason: null, createdBy: "mgr",
    });
    assert.throws(
      () => recordExtraPoint({
        personId: "ada", itemKey: "shoot", referenceId: "baska-marka",
        occurredAt: "2026-09-10T15:00:00Z", reason: null, createdBy: "mgr",
      }),
      /zaten yazılmış/,
      "aynı gün farklı markayla çoğaltılamaz",
    );
    const next = recordExtraPoint({
      personId: "ada", itemKey: "shoot", referenceId: "x",
      occurredAt: "2026-09-11T08:00:00Z", reason: null, createdBy: "mgr",
    });
    assert.equal(next.units, 200);
    assert.equal(unitsToPoints(getPersonPointSummary("ada", "2026-09")!.extra_units), 20);
  });

  it("yönetici puanı açıklamasız yazılamıyor", () => {
    assert.throws(
      () => recordManagerPoint({ personId: "ada", period: "2026-09", amountUnits: 40, reason: "  ", createdBy: "mgr" }),
      /açıklama zorunlu/,
    );
  });

  it("yanlış kayıt silinmiyor, gerekçeli ters kayıtla düzeltiliyor", () => {
    const id = recordManagerPoint({
      personId: "ada", period: "2026-09", amountUnits: 40,
      reason: "Ekstra destek", createdBy: "mgr",
    });
    reversePointEntry({ entryId: id, reason: "Yanlış kişiye yazıldı", createdBy: "mgr" });
    const summary = getPersonPointSummary("ada", "2026-09")!;
    assert.equal(summary.manager_units, 40);
    assert.equal(summary.correction_units, -40);
    assert.equal(summary.total_units, 0);
    assert.equal(listLedgerForPerson("ada", "2026-09").length, 2);
  });

  it("aynı kayıt iki kez terslenemiyor", () => {
    const id = recordManagerPoint({
      personId: "ada", period: "2026-09", amountUnits: 40,
      reason: "Ekstra destek", createdBy: "mgr",
    });
    reversePointEntry({ entryId: id, reason: "Düzeltme", createdBy: "mgr" });
    assert.throws(
      () => reversePointEntry({ entryId: id, reason: "Tekrar", createdBy: "mgr" }),
      /zaten terslenmiş/,
    );
  });
});

describe("kişi–profil eşlemesi", () => {
  it("profil tahmin edilmiyor; atanmadan null dönüyor", () => {
    assert.equal(personProfileForMonth("ada", "2026-09"), null);
    assignPersonPointProfile({
      personId: "ada", profile: "video", effectiveFrom: "2026-09-01", assignedBy: "mgr",
    });
    assert.equal(personProfileForMonth("ada", "2026-09"), "video");
  });

  it("profil değişikliği geçmiş ayı yeniden fiyatlamıyor", () => {
    assignPersonPointProfile({
      personId: "ada", profile: "video", effectiveFrom: "2026-09-01", assignedBy: "mgr",
    });
    assignPersonPointProfile({
      personId: "ada", profile: "ai_artist", effectiveFrom: "2026-10-01", assignedBy: "mgr",
    });
    assert.equal(personProfileForMonth("ada", "2026-09"), "video");
    assert.equal(personProfileForMonth("ada", "2026-10"), "ai_artist");
  });
});

describe("paket kapsam anahtarı", () => {
  it("marka kapsamı markayı, kişi kapsamı kişiyi çapa alıyor", () => {
    assert.equal(
      packageScopeKey({ profile: "video", scope: "brand", brandId: "b1", personId: "ada", planMonth: "2026-09", itemKey: "video.reels" }),
      "video|brand:b1|2026-09|video.reels",
    );
    assert.equal(
      packageScopeKey({ profile: "ai_artist", scope: "person", brandId: null, personId: "ada", planMonth: "2026-09", itemKey: "ai_artist.reels" }),
      "ai_artist|person:ada|2026-09|ai_artist.reels",
    );
  });
});
