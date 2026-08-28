import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  brandAccentHueForIndex,
  chooseBrandAccentHue,
  normalizeBrandAccentHue,
} from "@/lib/brandAccent";
import { migrationIds } from "@/lib/db/migrations";

describe("kalıcı marka vurgu rengi", () => {
  it("ilk 19 markaya magenta aralığına girmeyen farklı tonlar verir", () => {
    const hues = Array.from({ length: 19 }, (_, index) => brandAccentHueForIndex(index));
    assert.equal(new Set(hues).size, 19);
    assert.ok(hues.every((hue) => hue >= 15 && hue < 330));
  });

  it("yeni marka için önce kullanılmayan sabit yuvayı seçer", () => {
    const used = [brandAccentHueForIndex(0), brandAccentHueForIndex(1)];
    assert.equal(chooseBrandAccentHue(used), brandAccentHueForIndex(2));
  });

  it("geçersiz değerleri güvenli aralığa taşır", () => {
    assert.equal(normalizeBrandAccentHue(Number.NaN), 210);
    assert.equal(normalizeBrandAccentHue(-4), 15);
    assert.equal(normalizeBrandAccentHue(360), 329);
  });

  it("kalıcı renk göçünün sabit kimliğini korur", () => {
    assert.ok(migrationIds().includes("024-brands-accent-hue"));
  });
});
