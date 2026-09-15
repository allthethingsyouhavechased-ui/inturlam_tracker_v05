// Aylık toplu üretim ve otomasyon. Dört görev = dört BAĞIMSIZ içerik;
// 7/14/21/ayın sonu yalnızca tarih ÖNERİSİ. Paket tek transaction'da oluşur,
// aynı ay iki kez üretilemez ve geçmiş aylara sessizce görev yığılmaz.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

import { daysInMonth, renderTitlePattern, suggestedDueDates } from "@/lib/monthlyPlan";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-monthly-plans-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const {
  createMonthlyPackage,
  listMonthlyTaskPlans,
  listPlanRuns,
  previewMonthlyRows,
  runMonthlyPlans,
  upsertMonthlyTaskPlan,
} = await import("@/lib/repositories/monthlyPlans");
const { getPointPackage } = await import("@/lib/repositories/pointPackages");
const { listAllTasks } = await import("@/lib/repositories/tasks");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true });
}

function seed(): void {
  const db = getDb();
  db.prepare("INSERT INTO brands (id,name,cluster) VALUES ('b1','Marka Bir','tek')").run();
  db.prepare("INSERT INTO brands (id,name,cluster,archived) VALUES ('b2','Arşiv Marka','tek',1)").run();
  db.prepare("INSERT INTO people (id,name,is_manager) VALUES ('mgr','Yönetici',1)").run();
  db.prepare("INSERT INTO people (id,name) VALUES ('ada','Ada')").run();
  db.prepare("INSERT INTO people (id,name,active) VALUES ('pasif','Pasif',0)").run();
}

function rows(month = "2026-09", count = 4) {
  return previewMonthlyRows({
    month,
    count,
    titlePattern: "{marka} {ay} Reels {n}",
    brandName: "Marka Bir",
    contentType: "Reel",
    assigneeId: "ada",
  });
}

beforeEach(() => { resetDb(); seed(); });
after(resetDb);

describe("tarih önerileri", () => {
  it("dört görev için 7/14/21/ayın sonu öneriliyor", () => {
    assert.deepEqual(suggestedDueDates("2026-09", 4), ["2026-09-07", "2026-09-14", "2026-09-21", "2026-09-30"]);
    assert.deepEqual(suggestedDueDates("2026-10", 4), ["2026-10-07", "2026-10-14", "2026-10-21", "2026-10-31"]);
  });

  it("Şubat'ta ayın sonu doğru: 28 ve artık yılda 29", () => {
    assert.equal(daysInMonth("2026-02"), 28);
    assert.equal(daysInMonth("2028-02"), 29);
    assert.equal(suggestedDueDates("2026-02", 4).at(-1), "2026-02-28");
    assert.equal(suggestedDueDates("2028-02", 4).at(-1), "2028-02-29");
  });

  it("farklı adetlerde de son satır ayın son günü", () => {
    const dates = suggestedDueDates("2026-09", 6);
    assert.equal(dates.length, 6);
    assert.equal(dates.at(-1), "2026-09-30");
    assert.ok(dates.every((date) => date >= "2026-09-01" && date <= "2026-09-30"));
  });

  it("başlık kalıbında tanınmayan yer tutucu aynen kalıyor", () => {
    assert.equal(
      renderTitlePattern("{marka} {ay} Reels {n} {bilinmeyen}", { index: 2, month: "2026-09", brandName: "Marka Bir" }),
      "Marka Bir 2026-09 Reels 2 {bilinmeyen}",
    );
  });
});

describe("toplu paket üretimi", () => {
  it("dört BAĞIMSIZ içerik ve görev açıyor, hepsini tek pakette topluyor", () => {
    const result = createMonthlyPackage({
      brandId: "b1", profile: "video", itemKey: "video.reels", planMonth: "2026-09",
      personId: "ada", rows: rows(), createdBy: "mgr",
    });
    assert.equal(result.taskIds.length, 4);
    const tasks = listAllTasks();
    assert.equal(tasks.length, 4);
    // Dört ayrı içerik kaydı: tek işin dört aşaması DEĞİL.
    assert.equal(new Set(tasks.map((task) => task.content_item_id)).size, 4);
    const pkg = getPointPackage(result.packageId)!;
    assert.equal(pkg.member_count, 4);
    assert.equal(pkg.amount_units, 320);
    assert.equal(pkg.status, "Acik");
  });

  it("aynı marka/ay/kalem için ikinci paket üretilemiyor", () => {
    createMonthlyPackage({
      brandId: "b1", profile: "video", itemKey: "video.reels", planMonth: "2026-09",
      personId: "ada", rows: rows(), createdBy: "mgr",
    });
    assert.throws(
      () => createMonthlyPackage({
        brandId: "b1", profile: "video", itemKey: "video.reels", planMonth: "2026-09",
        personId: "ada", rows: rows(), createdBy: "mgr",
      }),
      /bu ay zaten bir paket üretilmiş/,
    );
    // Yarım paket kalmadı: ikinci denemenin görevleri yazılmadı.
    assert.equal(listAllTasks().length, 4);
  });

  it("katalog adedinden az satırla paket açılamıyor", () => {
    assert.throws(
      () => createMonthlyPackage({
        brandId: "b1", profile: "video", itemKey: "video.reels", planMonth: "2026-09",
        personId: "ada", rows: rows("2026-09", 4).slice(0, 3), createdBy: "mgr",
      }),
      /4 iş gerekiyor/,
    );
    assert.equal(listAllTasks().length, 0);
  });

  it("arşivli marka ve pasif kişi için üretim yapılmıyor", () => {
    assert.throws(
      () => createMonthlyPackage({
        brandId: "b2", profile: "video", itemKey: "video.reels", planMonth: "2026-09",
        personId: "ada", rows: rows(), createdBy: "mgr",
      }),
      /Arşivlenmiş marka/,
    );
    assert.throws(
      () => createMonthlyPackage({
        brandId: "b1", profile: "video", itemKey: "video.reels", planMonth: "2026-09",
        personId: "pasif", rows: rows(), createdBy: "mgr",
      }),
      /Pasif kişi/,
    );
    assert.equal(listAllTasks().length, 0);
  });
});

describe("aylık otomasyon", () => {
  function plan(overrides: Partial<Parameters<typeof upsertMonthlyTaskPlan>[0]> = {}): string {
    return upsertMonthlyTaskPlan({
      label: "Marka Bir aylık Reels",
      brandId: "b1",
      profile: "video",
      itemKey: "video.reels",
      assigneeId: "ada",
      contentType: "Reel",
      itemCount: 4,
      titlePattern: "{marka} {ay} Reels {n}",
      startMonth: "2026-09",
      generationDay: 1,
      paused: false,
      createdBy: "mgr",
      ...overrides,
    });
  }

  it("üretim günü gelince paketi açıyor, aynı ayı tekrar üretmiyor", () => {
    const planId = plan();
    const first = runMonthlyPlans({ today: "2026-09-01", actorId: "mgr" });
    assert.deepEqual(first.map((outcome) => outcome.status), ["ok"]);
    assert.equal(listAllTasks().length, 4);

    const second = runMonthlyPlans({ today: "2026-09-05", actorId: "mgr" });
    assert.deepEqual(second, [], "aynı ay ikinci kez üretilmemeli");
    assert.equal(listAllTasks().length, 4);
    assert.equal(listPlanRuns(planId).length, 1);
  });

  it("üretim günü gelmeden çalışmıyor", () => {
    plan({ generationDay: 10 });
    assert.deepEqual(runMonthlyPlans({ today: "2026-09-05", actorId: "mgr" }), []);
    assert.equal(listAllTasks().length, 0);
  });

  it("duraklatılmış plan ve başlangıç ayından önce üretim yapmıyor", () => {
    plan({ paused: true });
    assert.deepEqual(runMonthlyPlans({ today: "2026-09-01", actorId: "mgr" }), []);
    plan({ label: "Gelecek plan", paused: false, startMonth: "2026-12" });
    assert.deepEqual(runMonthlyPlans({ today: "2026-09-01", actorId: "mgr" }), []);
    assert.equal(listAllTasks().length, 0);
  });

  it("geçmiş aylara görev yığmıyor: yalnızca çalıştırılan ayın paketi açılıyor", () => {
    plan();
    runMonthlyPlans({ today: "2026-11-01", actorId: "mgr" });
    const tasks = listAllTasks();
    assert.equal(tasks.length, 4);
    // Eylül ve Ekim için geriye dönük paket ÜRETİLMEDİ.
    assert.ok(tasks.every((task) => (task.due_date ?? "").startsWith("2026-11")));
  });

  it("pasif sorumlu hatası yöneticiye gösteriliyor, sessizce atlanmıyor", () => {
    const planId = plan({ assigneeId: "pasif" });
    const outcomes = runMonthlyPlans({ today: "2026-09-01", actorId: "mgr" });
    assert.equal(outcomes[0].status, "error");
    assert.match(outcomes[0].message ?? "", /Pasif kişi/);
    const runs = listPlanRuns(planId);
    assert.equal(runs[0].status, "error");
    assert.match(runs[0].error ?? "", /Pasif kişi/);
    // Hatalı plan bir sonraki turda yeniden denenebiliyor.
    const view = listMonthlyTaskPlans().find((row) => row.id === planId)!;
    assert.equal(view.last_run_status, "error");
  });

  it("kesinti sonrası aynı ayın eksiği tamamlanabiliyor", () => {
    const planId = plan({ assigneeId: "pasif" });
    runMonthlyPlans({ today: "2026-09-01", actorId: "mgr" });
    // Sorumlu düzeltildi; aynı ay içinde yeniden çalıştırınca paket açılıyor.
    upsertMonthlyTaskPlan({
      id: planId,
      label: "Marka Bir aylık Reels",
      brandId: "b1",
      profile: "video",
      itemKey: "video.reels",
      assigneeId: "ada",
      contentType: "Reel",
      itemCount: 4,
      titlePattern: "{marka} {ay} Reels {n}",
      startMonth: "2026-09",
      generationDay: 1,
      paused: false,
      createdBy: "mgr",
    });
    const outcomes = runMonthlyPlans({ today: "2026-09-06", actorId: "mgr" });
    assert.equal(outcomes[0].status, "ok");
    assert.equal(listAllTasks().length, 4);
  });
});
