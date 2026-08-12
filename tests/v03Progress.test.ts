import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateMonthlyProgress, combineMonthlyProgress, TASK_STATUS_COEFFICIENT } from "@/lib/progress";

describe("v03 ağırlıklı aylık ilerleme", () => {
  it("beş durum katsayısını sabit tutar", () => {
    assert.deepEqual(TASK_STATUS_COEFFICIENT, {
      Beklemede: 0, DevamEdiyor: 0.25, Incelemede: 0.6, Onaylandi: 0.9, Yayinlandi: 1,
    });
  });

  it("görev ağırlıklarını normalize ederek yüzdeyi hesaplar", () => {
    const result = calculateMonthlyProgress("2026-08", [
      { status: "Beklemede", weight_points: 10 },
      { status: "DevamEdiyor", weight_points: 20 },
      { status: "Incelemede", weight_points: 30 },
      { status: "Onaylandi", weight_points: 10 },
      { status: "Yayinlandi", weight_points: 30 },
    ]);
    assert.equal(result.weighted_total, 100);
    assert.equal(result.weighted_earned, 62);
    assert.equal(result.percent, 62);
  });

  it("payda sıfırsa yüzde yerine plan yok durumunu üretir", () => {
    assert.equal(calculateMonthlyProgress("2026-08", []).percent, null);
  });

  it("birden fazla marka ilerlemesini yüzdeleri ortalamadan ağırlıklarıyla birleştirir", () => {
    const combined = combineMonthlyProgress("2026-08", [
      { month: "2026-08", weighted_total: 10, weighted_earned: 10, percent: 100, task_count: 1 },
      { month: "2026-08", weighted_total: 30, weighted_earned: 0, percent: 0, task_count: 3 },
    ]);
    assert.deepEqual(combined, {
      month: "2026-08", weighted_total: 40, weighted_earned: 10, percent: 25, task_count: 4,
    });
  });
});
