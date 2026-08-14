import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { matchesTaskFocus, parseTaskFocus } from "@/lib/taskFocus";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("görev metrik odakları", () => {
  const baseTask = { status: "Beklemede" as const, due_date: "2026-08-13" };

  it("yalnızca desteklenen URL odaklarını kabul eder", () => {
    assert.equal(parseTaskFocus("open"), "open");
    assert.equal(parseTaskFocus("overdue"), "overdue");
    assert.equal(parseTaskFocus("week"), "week");
    assert.equal(parseTaskFocus("anything"), "");
    assert.equal(parseTaskFocus(undefined), "");
  });

  it("açık, gecikmiş ve kalan hafta kapsamlarını ana sayfa sayımlarıyla eşler", () => {
    assert.equal(matchesTaskFocus(baseTask, "open", "2026-08-13", "2026-08-16"), true);
    assert.equal(matchesTaskFocus({ ...baseTask, status: "Yayinlandi" }, "open", "2026-08-13", "2026-08-16"), false);
    assert.equal(matchesTaskFocus({ ...baseTask, due_date: "2026-08-12" }, "overdue", "2026-08-13", "2026-08-16"), true);
    assert.equal(matchesTaskFocus({ ...baseTask, due_date: "2026-08-13" }, "overdue", "2026-08-13", "2026-08-16"), false);
    assert.equal(matchesTaskFocus({ ...baseTask, due_date: "2026-08-16" }, "week", "2026-08-13", "2026-08-16"), true);
    assert.equal(matchesTaskFocus({ ...baseTask, due_date: "2026-08-17" }, "week", "2026-08-13", "2026-08-16"), false);
  });
});

describe("aylık analiz navigasyonu", () => {
  it("ortak ay kontrolünü dört analiz yüzeyine bağlar", () => {
    const navigator = source("components/MonthNavigator.tsx");
    const home = source("app/page.tsx");
    const contribution = source("app/panom/katkim/page.tsx");
    const assignedBrands = source("app/panom/markalar/page.tsx");
    const brand = source("app/brands/[brandId]/page.tsx");
    const operations = source("components/BrandOperationsOverview.tsx");

    assert.match(navigator, /shiftMonthParam/);
    assert.match(navigator, /month !== currentMonth/);
    assert.match(home, /<MonthNavigator/);
    assert.match(contribution, /<MonthNavigator/);
    assert.match(assignedBrands, /<MonthNavigator/);
    assert.match(brand, /monthParamToDate\(sp\.month\)/);
    assert.match(operations, /<MonthNavigator/);
  });

  it("seçilen ayı marka detay linklerinde korur", () => {
    assert.match(source("components/HomeBrandProgress.tsx"), /month=\$\{month\}/);
    assert.match(source("app/panom/katkim/page.tsx"), /month=\$\{month\}/);
    assert.match(source("app/panom/markalar/page.tsx"), /month=\$\{month\}/);
  });

  it("katkı dökümünü durum analizinin altındaki geniş sütunda tutar", () => {
    const contribution = source("app/panom/katkim/page.tsx");
    const analysis = contribution.indexOf("Durum analizi");
    const breakdown = contribution.indexOf("Katkı dökümü");
    const rightColumn = contribution.indexOf('className="min-w-0 space-y-5"');
    assert.ok(rightColumn >= 0 && analysis > rightColumn && breakdown > analysis);
  });
});

describe("kapsam açıklamaları", () => {
  it("ana sayfa metriklerini gerçek görev filtrelerine bağlar", () => {
    const home = source("app/page.tsx");
    const tasks = source("app/tasks/page.tsx");
    const explorer = source("components/TaskExplorer.tsx");

    assert.match(home, /href="\/tasks\?focus=open"/);
    assert.match(home, /href="\/tasks\?focus=overdue"/);
    assert.match(home, /href="\/tasks\?focus=week"/);
    assert.match(tasks, /parseTaskFocus\(sp\.focus\)/);
    assert.match(explorer, /matchesTaskFocus/);
  });

  it("guest marka toplamı ile bu hesabın görevlerini açıkça ayırır", () => {
    const guest = source("app/guest/page.tsx");
    assert.match(guest, /MARKANIN TÜM PLANLANMIŞ İŞLERİ/);
    assert.match(guest, /BU HESAPTAN AÇILAN GÖREVLER/);
    assert.match(guest, /aynı kapsam değildir/);
  });
});
