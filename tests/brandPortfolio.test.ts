import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterAndSortBrandPortfolio, type BrandPortfolioRow } from "@/lib/brandPortfolio";

const rows: BrandPortfolioRow[] = [
  { id: "a", name: "İz Marka", logoPath: null, accentHue: 20, sortOrder: 2, clusterLabel: "Gıda", progressPercent: null, weightedEarned: 0, weightedTotal: 0, openCount: 1, socialHealth: null, socialDetail: null, instagramHandle: null, instagramUrl: null, responsibleNames: ["Şule"] },
  { id: "b", name: "Ada", logoPath: null, accentHue: 40, sortOrder: 1, clusterLabel: "Deniz", progressPercent: 80, weightedEarned: 8, weightedTotal: 10, openCount: 4, socialHealth: "ok", socialDetail: "1 gün", instagramHandle: "ada", instagramUrl: "https://instagram.com/ada", responsibleNames: ["Yunus"] },
];

describe("marka portföy tablosu", () => {
  it("varsayılan görünümde markaları Türkçe alfabetik sıralar", () => {
    assert.deepEqual(filterAndSortBrandPortfolio(rows, "", null, null).map((row) => row.id), ["b", "a"]);
  });

  it("Türkçe aramayı marka, kategori ve sorumlu alanlarında uygular", () => {
    assert.deepEqual(filterAndSortBrandPortfolio(rows, "iz marka", null, null).map((row) => row.id), ["a"]);
    assert.deepEqual(filterAndSortBrandPortfolio(rows, "yunus", null, null).map((row) => row.id), ["b"]);
  });

  it("planı olmayanı yüzde sıralamasında ayrı tutar ve yönü değiştirir", () => {
    assert.deepEqual(filterAndSortBrandPortfolio(rows, "", null, { key: "progress", direction: "asc" }).map((row) => row.id), ["a", "b"]);
    assert.deepEqual(filterAndSortBrandPortfolio(rows, "", null, { key: "progress", direction: "desc" }).map((row) => row.id), ["b", "a"]);
  });

  it("portföy şeridi seçimini tek markaya indirir", () => {
    assert.deepEqual(filterAndSortBrandPortfolio(rows, "", "a", null).map((row) => row.id), ["a"]);
  });
});
