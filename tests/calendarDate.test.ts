// Takvim (/calendar) sayfasının tarih matematiği. Ay ızgarasının başta/sonda
// tam hafta olacak şekilde dolgu günleriyle tamamlanması ve ?month= parametre
// ayrıştırma/kaydırma burada kilitleniyor — ikisi de sessizce yanlış
// hesaplanırsa (ör. ızgara eksik hafta bırakırsa ya da geçersiz bir ?month=
// sayfayı 500'letirse) fark edilmesi kolay değil.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calendarGridDays,
  monthParamISO,
  monthParamToDate,
  shiftMonthParam,
  shiftISODate,
  shouldShowTodayShortcut,
  validISODateParam,
} from "@/lib/date";

describe("calendarGridDays", () => {
  it("Şubat 2026: tam 5 hafta (35 gün), başta Ocak sonda Mart dolgusu", () => {
    const days = calendarGridDays(new Date(2026, 1, 15));
    assert.equal(days.length, 35);
    assert.deepEqual(days[0], { date: "2026-01-26", inMonth: false });
    assert.deepEqual(days.at(-1), { date: "2026-03-01", inMonth: false });

    const inMonth = days.filter((d) => d.inMonth);
    assert.equal(inMonth.length, 28, "2026 artık yıl değil, Şubat 28 gün");
    assert.equal(inMonth[0]?.date, "2026-02-01");
    assert.equal(inMonth.at(-1)?.date, "2026-02-28");
  });

  it("Ağustos 2026: tam 6 hafta (42 gün), başta Temmuz sonda Eylül dolgusu", () => {
    const days = calendarGridDays(new Date(2026, 7, 3));
    assert.equal(days.length, 42);
    assert.deepEqual(days[0], { date: "2026-07-27", inMonth: false });
    assert.deepEqual(days.at(-1), { date: "2026-09-06", inMonth: false });
    assert.equal(days.filter((d) => d.inMonth).length, 31);
  });

  it("günler ardışık: aralarında boşluk ya da tekrar yok", () => {
    const days = calendarGridDays(new Date(2026, 1, 15));
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(`${days[i - 1].date}T00:00:00Z`).getTime();
      const cur = new Date(`${days[i].date}T00:00:00Z`).getTime();
      assert.equal(cur - prev, 86_400_000);
    }
  });

  it("hafta Pazartesi'den başlıyor (currentWeekRange ile aynı kural)", () => {
    const days = calendarGridDays(new Date(2026, 1, 15));
    assert.equal(new Date(`${days[0].date}T00:00:00Z`).getUTCDay(), 1);
  });
});

describe("monthParamToDate / monthParamISO", () => {
  it("geçerli 'YYYY-MM' değerini ayın 1'ine çeviriyor", () => {
    const d = monthParamToDate("2026-07");
    assert.equal(monthParamISO(d), "2026-07");
    assert.equal(d.getDate(), 1);
  });

  it("eksik/bozuk değerde fallback'e düşüyor (sayfa 500 vermesin)", () => {
    const fallback = new Date(2026, 10, 5); // Kasım 2026
    for (const bad of [undefined, "", "garbage", "2026-13", "2026/07", "26-07"]) {
      const d = monthParamToDate(bad, fallback);
      assert.equal(monthParamISO(d), "2026-11", `girdi: ${String(bad)}`);
    }
  });
});

describe("shiftMonthParam", () => {
  it("bir önceki/sonraki aya kayıyor", () => {
    assert.equal(shiftMonthParam("2026-07", -1), "2026-06");
    assert.equal(shiftMonthParam("2026-07", 1), "2026-08");
  });

  it("yıl sınırında doğru dönüyor", () => {
    assert.equal(shiftMonthParam("2026-01", -1), "2025-12");
    assert.equal(shiftMonthParam("2026-12", 1), "2027-01");
  });
});

describe("shiftISODate", () => {
  it("gün ufkunu ay ve yıl sınırlarında kaydırıyor", () => {
    assert.equal(shiftISODate("2026-08-30", 7), "2026-09-06");
    assert.equal(shiftISODate("2026-12-30", 3), "2027-01-02");
  });
});

describe("takvim gün seçimi", () => {
  it("yalnızca gerçek ISO günlerini kabul ediyor", () => {
    assert.equal(validISODateParam("2026-02-28"), "2026-02-28");
    for (const invalid of [undefined, "", "2026-02-31", "2026-13-01", "28.02.2026"]) {
      assert.equal(validISODateParam(invalid), null);
    }
  });

  it("Bugün kısayolunu yalnızca başka ay veya başka gün seçildiğinde gösteriyor", () => {
    const today = "2026-08-12";
    assert.equal(shouldShowTodayShortcut("2026-08", null, today), false);
    assert.equal(shouldShowTodayShortcut("2026-08", today, today), false);
    assert.equal(shouldShowTodayShortcut("2026-08", "2026-08-18", today), true);
    assert.equal(shouldShowTodayShortcut("2026-09", null, today), true);
  });
});
