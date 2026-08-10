// Paylaşım takviminin ayı haftalara bölme kuralı: "bir ayın haftaları =
// Pazartesi'si o ayın içine düşen haftalar". Ekibin Google Sheet'indeki
// "Ağustos 1..5" hafta sekmeleriyle birebir eşleşmesi ve hiçbir günün iki ay
// sekmesine birden düşmemesi/kaybolmaması burada kilitleniyor.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calendarGridDays, monthWeeks, weekIndexForDate } from "@/lib/date";

describe("monthWeeks", () => {
  it("Ağustos 2026: ekran görüntüsündeki 5 haftayla birebir eşleşir", () => {
    const weeks = monthWeeks(new Date(2026, 7, 1));
    assert.equal(weeks.length, 5);
    assert.deepEqual(
      weeks.map((w) => [w.start, w.end]),
      [
        ["2026-08-03", "2026-08-09"],
        ["2026-08-10", "2026-08-16"], // ekranda "2. Hafta | 10-6 Ağustos"
        ["2026-08-17", "2026-08-23"],
        ["2026-08-24", "2026-08-30"],
        ["2026-08-31", "2026-09-06"],
      ],
    );
    assert.deepEqual(
      weeks.map((w) => w.index),
      [1, 2, 3, 4, 5],
    );
  });

  it("Şubat 2026: 1 Şubat Pazar olduğu için ilk hafta Ocak'ın son haftası değil, 2 Şubat'tan başlar", () => {
    const weeks = monthWeeks(new Date(2026, 1, 15));
    assert.equal(weeks.length, 4);
    assert.equal(weeks[0]?.start, "2026-02-02");
    assert.equal(weeks.at(-1)?.end, "2026-03-01");
  });

  it("her hafta tam 7 gün, Pazartesi ile başlar", () => {
    for (const week of monthWeeks(new Date(2026, 7, 1))) {
      assert.equal(week.days.length, 7);
      assert.equal(week.days[0]?.date, week.start);
      assert.equal(week.days[6]?.date, week.end);
      assert.equal(new Date(`${week.start}T00:00:00Z`).getUTCDay(), 1, "Pazartesi");
    }
  });

  it("hafta sayısı her zaman 4 ya da 5 (24 ay boyunca)", () => {
    for (let i = 0; i < 24; i++) {
      const count = monthWeeks(new Date(2025, i, 1)).length;
      assert.ok(count === 4 || count === 5, `ay ${i}: ${count} hafta`);
    }
  });

  it("bölüntü: 14 ardışık ayın günleri uç uca eklenince kesintisiz ve tekrarsız", () => {
    const allDays: string[] = [];
    for (let i = 0; i < 14; i++) {
      const monthDate = new Date(2026, i, 1);
      for (const week of monthWeeks(monthDate)) {
        for (const day of week.days) allDays.push(day.date);
      }
    }
    // Tekrarsız.
    assert.equal(new Set(allDays).size, allDays.length, "hiçbir gün iki ay sekmesine birden düşmemeli");
    // Kesintisiz: her komşu gün tam 1 gün arayla.
    for (let i = 1; i < allDays.length; i++) {
      const prev = new Date(`${allDays[i - 1]}T00:00:00Z`).getTime();
      const cur = new Date(`${allDays[i]}T00:00:00Z`).getTime();
      assert.equal(cur - prev, 86_400_000, `${allDays[i - 1]} → ${allDays[i]}`);
    }
  });

  it("inMonth bayrağı: Ağustos'un 5. haftasında (31 Ağu – 6 Eyl) yalnızca 31'i Ağustos'a ait", () => {
    const lastWeek = monthWeeks(new Date(2026, 7, 1)).at(-1)!;
    assert.equal(lastWeek.days.filter((d) => d.inMonth).length, 1);
    assert.equal(lastWeek.days.filter((d) => !d.inMonth).length, 6);
    assert.equal(lastWeek.days[0]?.inMonth, true, "31 Ağustos");
    assert.equal(lastWeek.days[1]?.inMonth, false, "1 Eylül");
  });

  it("etiket: aynı ay içindeyse tek ay adı, ay aşarsa iki ay adı, yıl aşarsa iki yıl", () => {
    const weeks = monthWeeks(new Date(2026, 7, 1));
    assert.equal(weeks[1]?.label, "10 – 16 Ağustos");
    assert.equal(weeks.at(-1)?.label, "31 Ağustos – 6 Eylül");

    // Aralık 2026'nın son haftası (28 Ara – 3 Oca) 2027'ye taşıyor — etiket
    // her iki yılı da göstermeli, aksi halde "3 Ocak" hangi yıla ait belli olmaz.
    const decemberLastWeek = monthWeeks(new Date(2026, 11, 1)).at(-1)!;
    assert.equal(decemberLastWeek.start, "2026-12-28");
    assert.equal(decemberLastWeek.end, "2027-01-03");
    assert.match(decemberLastWeek.label, /2026.*2027/);
  });

  it("calendarGridDays'ten BİLEREK farklı: Ağustos 2026'da 5 hafta (35 gün) vs ızgaranın 6 satırı (42 gün)", () => {
    assert.equal(monthWeeks(new Date(2026, 7, 1)).length * 7, 35);
    assert.equal(calendarGridDays(new Date(2026, 7, 1)).length, 42);
  });
});

describe("weekIndexForDate", () => {
  it("ayın ortasındaki bir gün için doğru hafta index'ini döner", () => {
    assert.equal(weekIndexForDate(new Date(2026, 7, 1), "2026-08-12"), 2);
  });

  it("ayın haftalarının dışındaki bir gün için null döner", () => {
    // 1 Ağustos, Ağustos'un haftalarına değil Temmuz'un son haftasına ait.
    assert.equal(weekIndexForDate(new Date(2026, 7, 1), "2026-08-01"), null);
  });
});
