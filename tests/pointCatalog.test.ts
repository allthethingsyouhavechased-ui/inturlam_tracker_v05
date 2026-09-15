// Katalog aritmetiği. Plandaki sayısal testler burada birebir kilitleniyor:
// Video 4×80 + 4×20 + 15×4 = 460 birim/marka, 4 marka = 92 puan;
// Grafik 8×25 + 12×5 + 4×15 = 320, 6 marka = 96;
// SM 120+60+45 = 225, 8 marka = 90;
// AI 10×100 + 10×50 + 30×10 = 1.800 = 90 ve marka sayısı sonucu DEĞİŞTİRMEZ.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EXTRA_POINT_ITEMS,
  MONTHLY_TARGET_UNITS,
  catalogItem,
  extraPointItem,
  packageUnitsFor,
  profileSetUnits,
} from "@/lib/points/catalog";
import {
  UNITS_PER_POINT,
  formatUnitsAsPoints,
  parsePointInputToUnits,
  pointsToUnits,
  unitsToPoints,
} from "@/lib/points/units";

describe("iç birim aritmetiği", () => {
  it("1 puan 20 birim, 0,05 puan 1 birim", () => {
    assert.equal(UNITS_PER_POINT, 20);
    assert.equal(pointsToUnits(1), 20);
    assert.equal(pointsToUnits(0.05), 1);
    assert.equal(pointsToUnits(1.25), 25);
    assert.equal(pointsToUnits(0.2), 4);
  });

  it("kesirli katalog değerleri kayıpsız toplanıyor", () => {
    // 0,20 × 15 kayan noktada 2,9999999999999996 veriyor; birimle tam 60.
    const units = 15 * pointsToUnits(0.2);
    assert.equal(units, 60);
    assert.equal(unitsToPoints(units), 3);
  });

  it("0,05'in katı olmayan giriş reddediliyor", () => {
    assert.equal(parsePointInputToUnits("2,5"), 50);
    assert.equal(parsePointInputToUnits("0,05"), 1);
    assert.throws(() => parsePointInputToUnits("0,03"), /0,05'in katı/);
    assert.throws(() => parsePointInputToUnits("abc"), /sayı olmalı/);
  });

  it("gösterimde tam sayı ve kesirli ayrı biçimleniyor", () => {
    assert.equal(formatUnitsAsPoints(320), "16");
    assert.equal(formatUnitsAsPoints(225), "11,25");
  });
});

describe("katalog set değerleri", () => {
  it("video marka seti 460 birim = 23 puan, 4 marka 92 puan", () => {
    assert.equal(packageUnitsFor(catalogItem("video", "video.reels")!), 320);
    assert.equal(packageUnitsFor(catalogItem("video", "story_video")!), 80);
    assert.equal(packageUnitsFor(catalogItem("video", "photo_edit")!), 60);
    assert.equal(profileSetUnits("video"), 460);
    assert.equal(unitsToPoints(460), 23);
    assert.equal(unitsToPoints(4 * 460), 92);
  });

  it("grafik marka seti 320 birim = 16 puan, 6 marka 96 puan", () => {
    assert.equal(profileSetUnits("graphic"), 320);
    assert.equal(unitsToPoints(320), 16);
    assert.equal(unitsToPoints(6 * 320), 96);
  });

  it("sosyal medya marka seti 225 birim = 11,25 puan, 8 marka 90 puan", () => {
    assert.equal(profileSetUnits("social"), 225);
    assert.equal(unitsToPoints(225), 11.25);
    assert.equal(unitsToPoints(8 * 225), 90);
  });

  it("AI seti 1.800 birim = 90 puan ve KİŞİ bazlıdır", () => {
    assert.equal(profileSetUnits("ai_artist"), 1800);
    assert.equal(unitsToPoints(1800), 90);
    // Marka çarpanı yok: bütün AI kalemleri kişi kapsamında.
    for (const key of ["ai_artist.reels", "ai_video", "ai_image"]) {
      assert.equal(catalogItem("ai_artist", key)!.scope, "person");
    }
    // Marka kapsamındaki profillerde kalem kapsamı marka.
    assert.equal(catalogItem("video", "video.reels")!.scope, "brand");
  });

  it("Video Reels ile AI Reels ayrı anahtar ve ayrı fiyat", () => {
    assert.equal(catalogItem("video", "video.reels")!.unitUnits, 80);
    assert.equal(catalogItem("ai_artist", "ai_artist.reels")!.unitUnits, 100);
    assert.equal(catalogItem("video", "ai_artist.reels"), undefined);
  });

  it("aylık kişi hedefi 100 puan", () => {
    assert.equal(MONTHLY_TARGET_UNITS, 2000);
    assert.equal(unitsToPoints(MONTHLY_TARGET_UNITS), 100);
  });
});

describe("ek puan havuzu", () => {
  it("kalem fiyatları sabit; yalnız yönetici puanı serbest", () => {
    assert.equal(extraPointItem("shoot")!.units, 200);
    assert.equal(extraPointItem("brand_onboarding")!.units, 100);
    assert.equal(extraPointItem("applied_idea")!.units, 100);
    assert.equal(extraPointItem("extra_reels")!.units, 80);
    assert.equal(extraPointItem("client_meeting")!.units, 40);
    assert.equal(extraPointItem("script_writing")!.units, 40);
    assert.equal(extraPointItem("trend_analysis")!.units, 40);
    const free = EXTRA_POINT_ITEMS.filter((item) => item.units === null);
    assert.deepEqual(free.map((item) => item.key), ["manager_review"]);
  });

  it("çekim kişi + gün başına tekil", () => {
    assert.equal(extraPointItem("shoot")!.uniqueness, "person-day");
  });

  it("video 92 + bir çekim 102, iki çekim 112", () => {
    const video = 4 * profileSetUnits("video");
    const shoot = extraPointItem("shoot")!.units!;
    assert.equal(unitsToPoints(video + shoot), 102);
    assert.equal(unitsToPoints(video + 2 * shoot), 112);
  });
});
