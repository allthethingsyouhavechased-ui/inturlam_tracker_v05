import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-v03-brand-operations-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;
const { getDb } = await import("@/lib/db/client");
const { getBrand, updateBrand } = await import("@/lib/repositories/brands");
const { listBrandPersonAssignments } = await import("@/lib/repositories/brandAssignments");

function resetDb() {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true });
}

beforeEach(resetDb);
after(resetDb);

describe("v03 marka operasyon özeti", () => {
  it("aylık ve yıllık çekim haklarını ve marka sorumlularını veri kaybetmeden taşır", () => {
    const db = getDb();
    db.prepare("INSERT INTO brands (id,name,cluster) VALUES ('b1','Bir','tek')").run();
    db.prepare("INSERT INTO people (id,name,title) VALUES ('p1','Ada','İçerik Tasarımcısı')").run();
    db.prepare("INSERT INTO person_brand_assignments (person_id,brand_id,assigned_by) VALUES ('p1','b1','p1')").run();
    updateBrand({ id: "b1", name: "Bir", cluster: "tek", instagramHandle: null, followerCount: null, postCount: null, keyFinding: null, tier: null, monthlyShootAllowance: 3, annualShootAllowance: 24, today: "2026-08-12" });
    assert.equal(getBrand("b1")?.monthly_shoot_allowance, 3);
    assert.equal(getBrand("b1")?.annual_shoot_allowance, 24);
    assert.throws(() => db.prepare("UPDATE brands SET annual_shoot_allowance = -1 WHERE id = 'b1'").run());
    assert.deepEqual(listBrandPersonAssignments("b1").map((row) => row.person_name), ["Ada"]);
  });

  it("marka, Panom ve görev yüzeylerinde istenen operasyon bilgilerini gösterir", () => {
    const overview = fs.readFileSync(path.join(process.cwd(), "components/BrandOperationsOverview.tsx"), "utf8");
    const panom = fs.readFileSync(path.join(process.cwd(), "app/panom/page.tsx"), "utf8");
    const card = fs.readFileSync(path.join(process.cwd(), "components/TaskGridCard.tsx"), "utf8");
    const list = fs.readFileSync(path.join(process.cwd(), "components/TaskListView.tsx"), "utf8");
    assert.match(overview, /ÇEKİM HAKLARI/);
    assert.match(overview, /YILLIK/);
    assert.match(overview, /AYLIK İŞ İLERLEMESİ/);
    assert.match(overview, /AYLIK İÇERİK AKIŞI/);
    assert.match(overview, /Toplantılar/);
    assert.match(overview, /Çekimler/);
    assert.match(panom, /getBrandMonthlyProgress/);
    assert.match(card, /task\.weight_points/);
    assert.match(list, /t\.weight_points/);
  });
});
