import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, test } from "node:test";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "intracker-shoot-usage-"));
process.env.INTURLAM_DB_PATH = path.join(root, "test.db");
const { getDb } = await import("@/lib/db/client");
const { createBrand, getBrandShootUsage, getBrandShootUsageDetails, setBrandShootUsage } = await import("@/lib/repositories/brands");
const { assertMonthPeriod, assertYearPeriod } = await import("@/lib/periodValidation");
let brand: string;
beforeEach(() => { brand = createBrand({ name: "Test", cluster: "test", instagramHandle: null }); });
after(() => { globalThis.__inturlamDb?.close(); globalThis.__inturlamDb = undefined; fs.rmSync(root, { recursive: true, force: true }); });

test("nonexistent months and unsafe counts never write", () => {
  for (const period of ["2026-00", "2026-13", "2026-99", "0000-01", "2026-1", "2026-01-01", "20261"]) {
    assert.throws(() => setBrandShootUsage(brand, period, 3));
    assert.throws(() => getBrandShootUsage(brand, period));
  }
  for (const used of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => setBrandShootUsage(brand, "2026-09", used));
  assert.equal(getBrandShootUsage(brand, "2026-09"), null);
  assert.equal(assertMonthPeriod("2028-02"), "2028-02");
  assert.equal(assertYearPeriod("2026"), "2026");
});

test("manual zero, independent annual usage, calendar reset and no-op audit", () => {
  setBrandShootUsage(brand, "2026-09", 0);
  setBrandShootUsage(brand, "2026", 12);
  setBrandShootUsage(brand, "2026-09", 0);
  assert.equal(getBrandShootUsageDetails(brand, "2026-09").source, "manual");
  assert.equal(getBrandShootUsage(brand, "2026-09"), 0);
  assert.equal(getBrandShootUsage(brand, "2026"), 12);
  assert.equal(getDb().prepare("SELECT COUNT(*) AS n FROM brand_shoot_usage_history WHERE brand_id = ?").get(brand)?.n, 2);
  setBrandShootUsage(brand, "2026-09", null);
  const reset = getBrandShootUsageDetails(brand, "2026-09");
  assert.equal(reset.source, "calendar");
  assert.equal(reset.used, null);
  assert.ok(reset.updated_at);
  assert.equal(getBrandShootUsage(brand, "2026"), 12);
});

test("audit failure rolls back counter and legacy manual record stays readable", () => {
  getDb().prepare("INSERT INTO brand_shoot_usage (brand_id, period, used_count) VALUES (?, '2026-09', 4)").run(brand);
  const legacy = getBrandShootUsageDetails(brand, "2026-09");
  assert.equal(legacy.used, 4);
  assert.ok(legacy.updated_at);
  assert.equal(legacy.actor_name, null);
  assert.throws(() => setBrandShootUsage(brand, "2026-09", 9, "missing-person"));
  assert.equal(getBrandShootUsage(brand, "2026-09"), 4);
});
