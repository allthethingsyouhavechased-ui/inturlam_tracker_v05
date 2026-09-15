// Sosyal medya üretim planı: aylık hedef, elde hazır varlık, paylaşım
// takvimi. Ağa çıkmaz, gerçek veriye dokunmaz (geçici DB).

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-social-plan-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const {
  listBrandAssetCounts,
  listBrandContentTargets,
  getBrandMonthlyContentCompletion,
  listBrandVarlikRows,
  listPlanEntriesInRange,
  setBrandAssetCount,
  setBrandContentTarget,
  setBrandMonthlyContentCompletion,
  setBrandPlanEntry,
} = await import("@/lib/repositories/socialPlan");
const { deleteBrand } = await import("@/lib/repositories/brands");
const { clampCount, countKindsInCombos, isPlanCombo, isValidPlanMonth, parseCountInput } =
  await import("@/lib/socialPlan");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(TMP_DB + suffix, { force: true });
  }
}

function seedBase(): void {
  const db = getDb();
  db.prepare(
    "INSERT INTO brands (id, name, cluster, sort_order) VALUES ('arkay', 'Arkay Marine', 'balik-deniz', 10)",
  ).run();
  db.prepare(
    "INSERT INTO brands (id, name, cluster, sort_order) VALUES ('tersan', 'Tersan Marine', 'balik-deniz', 20)",
  ).run();
  db.prepare(
    "INSERT INTO brands (id, name, cluster, sort_order, archived) VALUES ('eski', 'Eski Marka', 'tek', 30, 1)",
  ).run();
}

beforeEach(() => {
  resetDb();
  seedBase();
});
after(resetDb);

describe("brand_content_targets (hedef)", () => {
  it("upsert: ikinci yazımda tek satır kalır, updated_at değişir", () => {
    setBrandContentTarget("arkay", "Post", 15);
    const first = listBrandContentTargets()[0];
    assert.equal(first?.monthly_target, 15);

    setBrandContentTarget("arkay", "Post", 12);
    const rows = listBrandContentTargets();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.monthly_target, 12);
  });

  it("hiçbir okuma null-prototype döndürmez (plainList unutulmamış)", () => {
    setBrandContentTarget("arkay", "Post", 15);
    const row = listBrandContentTargets()[0];
    assert.equal(Object.getPrototypeOf(row), Object.prototype);
  });
});

describe("brand_asset_counts (varlık)", () => {
  it("0 geçerli bir değerdir, undefined değil", () => {
    setBrandAssetCount("arkay", "Post", 0);
    const rows = listBrandAssetCounts();
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.ready_count, 0);
  });

  it("upsert ikinci yazımda tek satır kalır", () => {
    setBrandAssetCount("arkay", "Reels", 2);
    setBrandAssetCount("arkay", "Reels", 4);
    const rows = listBrandAssetCounts().filter((r) => r.brand_id === "arkay" && r.kind === "Reels");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.ready_count, 4);
  });
});

describe("listBrandVarlikRows", () => {
  it("hedefi/sayacı olmayan marka da satır üretir (0/0), arşivli marka üretmez", () => {
    setBrandContentTarget("arkay", "Post", 15);
    setBrandContentTarget("arkay", "Story", 15);
    setBrandContentTarget("arkay", "Reels", 4);
    setBrandAssetCount("arkay", "Post", 7);
    setBrandAssetCount("arkay", "Story", 5);
    setBrandAssetCount("arkay", "Reels", 2);

    const rows = listBrandVarlikRows("2026-08");
    assert.equal(rows.length, 2, "yalnızca arşivlenmemiş 2 marka");
    assert.ok(!rows.some((r) => r.brand_id === "eski"), "arşivli marka görünmemeli");

    const arkay = rows.find((r) => r.brand_id === "arkay");
    assert.deepEqual(arkay?.targets, { Post: 15, Story: 15, Reels: 4 });
    assert.deepEqual(arkay?.ready, { Post: 7, Story: 5, Reels: 2 });
    assert.equal(arkay?.monthly_content_completed, false);

    const tersan = rows.find((r) => r.brand_id === "tersan");
    assert.deepEqual(tersan?.targets, { Post: 0, Story: 0, Reels: 0 });
    assert.deepEqual(tersan?.ready, { Post: 0, Story: 0, Reels: 0 });
  });

  it("aylık teslim kapanışını canlı hazır varlık sayısından bağımsız tutar", () => {
    setBrandAssetCount("arkay", "Post", 15);
    setBrandMonthlyContentCompletion({
      brandId: "arkay",
      month: "2026-08",
      completed: true,
      actorId: null,
    });
    setBrandAssetCount("arkay", "Post", 3);

    const august = listBrandVarlikRows("2026-08").find((row) => row.brand_id === "arkay");
    const september = listBrandVarlikRows("2026-09").find((row) => row.brand_id === "arkay");
    assert.equal(august?.ready.Post, 3, "hazır stok paylaşım oldukça azalabilir");
    assert.equal(august?.monthly_content_completed, true, "aylık teslim kapanışı korunmalı");
    assert.equal(september?.monthly_content_completed, false, "kapanış yalnızca seçili aya aittir");

    setBrandMonthlyContentCompletion({
      brandId: "arkay",
      month: "2026-08",
      completed: false,
      actorId: null,
    });
    assert.equal(getBrandMonthlyContentCompletion("arkay", "2026-08"), undefined);
  });
});

describe("brand_plan_entries (paylaşım takvimi)", () => {
  it("boş kombinasyon (null) satırı siler, tekrar yazmaz", () => {
    setBrandPlanEntry("arkay", "2026-08-10", "Post+Story");
    assert.equal(listPlanEntriesInRange("2026-08-10", "2026-08-10").length, 1);

    setBrandPlanEntry("arkay", "2026-08-10", null);
    assert.equal(listPlanEntriesInRange("2026-08-10", "2026-08-10").length, 0);
    const count = getDb()
      .prepare("SELECT COUNT(*) AS n FROM brand_plan_entries WHERE brand_id = 'arkay'")
      .get() as { n: number };
    assert.equal(count.n, 0, "silinen satırın yerine boş combo'lu satır kalmamalı");
  });

  it("upsert: aynı gün ikinci seçim eskisinin üstüne yazar", () => {
    setBrandPlanEntry("arkay", "2026-08-10", "Post");
    setBrandPlanEntry("arkay", "2026-08-10", "Reels+Story");
    const rows = listPlanEntriesInRange("2026-08-10", "2026-08-10");
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.combo, "Reels+Story");
  });

  it("aralık iki uçta da dahildir", () => {
    setBrandPlanEntry("arkay", "2026-08-09", "Post");
    setBrandPlanEntry("arkay", "2026-08-10", "Story");
    setBrandPlanEntry("arkay", "2026-08-16", "Reels");
    setBrandPlanEntry("arkay", "2026-08-17", "Post");

    const rows = listPlanEntriesInRange("2026-08-10", "2026-08-16");
    assert.deepEqual(
      rows.map((r) => r.plan_date),
      ["2026-08-10", "2026-08-16"],
    );
  });
});

describe("marka silinince plan verileri de silinir (ON DELETE CASCADE)", () => {
  it("aylık teslim kapanışı dahil plan verileri boşalır, FK ihlali kalmaz", () => {
    setBrandContentTarget("arkay", "Post", 15);
    setBrandAssetCount("arkay", "Post", 7);
    setBrandPlanEntry("arkay", "2026-08-10", "Post");
    setBrandMonthlyContentCompletion({ brandId: "arkay", month: "2026-08", completed: true, actorId: null });

    deleteBrand("arkay");

    assert.equal(listBrandContentTargets().filter((r) => r.brand_id === "arkay").length, 0);
    assert.equal(listBrandAssetCounts().filter((r) => r.brand_id === "arkay").length, 0);
    assert.equal(listPlanEntriesInRange("2026-08-01", "2026-08-31").length, 0);
    assert.equal(getBrandMonthlyContentCompletion("arkay", "2026-08"), undefined);
    assert.deepEqual(getDb().prepare("PRAGMA foreign_key_check").all(), []);
  });
});

describe("saf yardımcı fonksiyonlar (lib/socialPlan.ts)", () => {
  it("countKindsInCombos: LinkedIn hiçbir türe sayılmaz, kombinasyondaki türler sayılır", () => {
    assert.deepEqual(
      countKindsInCombos(["Post+Story", "Linkedin+Reels", "Linkedin", "gecersiz-deger"]),
      { Post: 1, Story: 1, Reels: 1 },
    );
  });

  it("isPlanCombo büyük/küçük harfe duyarlıdır (saklanan değerlerle birebir eşleşir)", () => {
    assert.equal(isPlanCombo("Post+Story"), true);
    assert.equal(isPlanCombo("post+story"), false);
    assert.equal(isPlanCombo("Uydurma"), false);
  });

  it("clampCount: negatifi 0'a, üst sınırı 999'a çeker, ondalığı keser", () => {
    assert.equal(clampCount(-5), 0);
    assert.equal(clampCount(1_000_000), 999);
    assert.equal(clampCount(3.7), 3);
  });

  it("parseCountInput: boş/NaN yok sayılır, geçerli metin sayıya çevrilir", () => {
    assert.equal(parseCountInput(""), null);
    assert.equal(parseCountInput("abc"), null);
    assert.equal(parseCountInput("  12 "), 12);
    assert.equal(parseCountInput("99999"), 999);
  });

  it("aylık kapanış yalnızca gerçek YYYY-MM değerini kabul eder", () => {
    assert.equal(isValidPlanMonth("2026-08"), true);
    assert.equal(isValidPlanMonth("2026-13"), false);
    assert.equal(isValidPlanMonth("2026-8"), false);
    assert.equal(isValidPlanMonth("Ağustos 2026"), false);
  });

  it("marka ve varlık arayüzü canlı stok ile aylık teslimi açıkça ayırır", () => {
    const brandSection = fs.readFileSync(path.join(process.cwd(), "components/BrandContentTargetsSection.tsx"), "utf8");
    const assetPage = fs.readFileSync(path.join(process.cwd(), "app/social/varlik/page.tsx"), "utf8");
    // Tablo, sütun başlığından sıralanabilmesi için istemci bileşenine taşındı;
    // canlı stok / aylık teslim ayrımı ikisinde birden aranıyor.
    const assetTable = fs.readFileSync(path.join(process.cwd(), "components/SocialVarlikTable.tsx"), "utf8");
    assert.match(brandSection, /Aylık içerikler tamamlandı/);
    assert.match(brandSection, /aria-pressed/);
    assert.match(assetPage, /canlı stok/);
    assert.match(assetPage, /eksik teslim anlamına gelmez/);
    assert.match(assetTable, /monthly_content_completed/);
    assert.match(assetPage, /Hazır içerik varlığı[\s\S]*Yayına hazır canlı stok/);
    assert.doesNotMatch(assetPage, /max-w-4xl/);
    assert.doesNotMatch(assetPage, /role="note"/);
  });

  it("varlık tablosu sütun başlıklarından sıralanabiliyor", () => {
    const assetTable = fs.readFileSync(path.join(process.cwd(), "components/SocialVarlikTable.tsx"), "utf8");
    // Erişilebilirlik sözleşmesi: sıralama düğmesi ve aria-sort durumu.
    assert.match(assetTable, /aria-sort/);
    assert.match(assetTable, /onClick=\{\(\) => toggle\(key\)\}/);
  });

  it("hafta ve ay seçicilerini tek araç satırında tutar", () => {
    const calendarPage = fs.readFileSync(path.join(process.cwd(), "app/social/takvim/page.tsx"), "utf8");
    const toolbarStart = calendarPage.indexOf('className="flex flex-col gap-2 sm:flex-row');
    const weekNav = calendarPage.indexOf('aria-label="Hafta seçimi"', toolbarStart);
    const monthNav = calendarPage.indexOf('aria-label="Önceki ay"', weekNav);
    assert.ok(toolbarStart >= 0);
    assert.ok(weekNav > toolbarStart);
    assert.ok(monthNav > weekNav);
    assert.doesNotMatch(calendarPage, /Haftalık paylaşım planı/);
  });
});
