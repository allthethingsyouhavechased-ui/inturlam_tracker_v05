// Stok / hedef hesabı. Kritik kural: TOPLAM EKSİK, marka eksiklerinin
// toplamıdır — bir markadaki fazla stok başka markadaki eksiği KAPATMAZ.
// Hedef yoksa oran üretilmez ("0 yüzde" ile "hedef tanımlı değil" ayrı şey).

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NO_TARGET_LABEL,
  barPercent,
  ratioLabel,
  stockCell,
  stockRow,
  stockTotals,
} from "@/lib/socialStock";
import type { BrandVarlikRow } from "@/lib/types";

function brand(
  id: string,
  ready: { Post: number; Story: number; Reels: number },
  targets: { Post: number; Story: number; Reels: number },
): BrandVarlikRow {
  return {
    brand_id: id,
    brand_name: id,
    logo_path: null,
    ready,
    targets,
    monthly_content_completed: false,
    monthly_content_completed_at: null,
  };
}

describe("stok hücresi", () => {
  it("eksik = max(hedef - stok, 0), fazla = max(stok - hedef, 0)", () => {
    assert.deepEqual(stockCell("Post", 3, 8), { kind: "Post", ready: 3, target: 8, missing: 5, surplus: 0, ratio: 38 });
    assert.deepEqual(stockCell("Post", 10, 8), { kind: "Post", ready: 10, target: 8, missing: 0, surplus: 2, ratio: 125 });
    assert.deepEqual(stockCell("Post", 8, 8), { kind: "Post", ready: 8, target: 8, missing: 0, surplus: 0, ratio: 100 });
  });

  it("hedef yoksa oran üretmiyor", () => {
    const cell = stockCell("Reels", 4, 0);
    assert.equal(cell.ratio, null);
    assert.equal(cell.missing, 0);
    assert.equal(cell.surplus, 4);
    assert.equal(ratioLabel(cell.ratio), NO_TARGET_LABEL);
  });

  it("sıfır stok hedefli markada tam eksik sayılıyor", () => {
    const cell = stockCell("Story", 0, 12);
    assert.equal(cell.missing, 12);
    assert.equal(cell.ratio, 0);
    assert.equal(ratioLabel(cell.ratio), "%0");
  });

  it("grafik %100'de doluyor ama sayısal oran 100 üstünü gösteriyor", () => {
    assert.equal(barPercent(125), 100);
    assert.equal(barPercent(38), 38);
    assert.equal(barPercent(null), 0);
    assert.equal(ratioLabel(125), "%125");
  });
});

describe("portföy toplamı", () => {
  it("bir markanın fazlası diğerinin eksiğini kapatmıyor", () => {
    const rows = [
      // A markası 5 eksik, B markası 5 fazla.
      stockRow(brand("a", { Post: 3, Story: 0, Reels: 0 }, { Post: 8, Story: 0, Reels: 0 })),
      stockRow(brand("b", { Post: 13, Story: 0, Reels: 0 }, { Post: 8, Story: 0, Reels: 0 })),
    ];
    const totals = stockTotals(rows);
    assert.equal(totals.ready, 16);
    assert.equal(totals.target, 16);
    // Naif hesap (max(toplam hedef - toplam stok, 0)) 0 verirdi; doğrusu 5.
    assert.equal(totals.missing, 5);
    assert.equal(totals.surplus, 5);
  });

  it("tür filtresi toplamı daraltıyor", () => {
    const rows = [stockRow(brand("a", { Post: 3, Story: 2, Reels: 1 }, { Post: 8, Story: 12, Reels: 4 }))];
    assert.equal(stockTotals(rows, "Post").missing, 5);
    assert.equal(stockTotals(rows, "Story").missing, 10);
    assert.equal(stockTotals(rows).missing, 18);
  });

  it("marka satırı kendi toplam eksiğini taşıyor", () => {
    const row = stockRow(brand("a", { Post: 3, Story: 12, Reels: 6 }, { Post: 8, Story: 12, Reels: 4 }));
    assert.equal(row.totalMissing, 5);
    assert.equal(row.totalSurplus, 2);
  });
});
