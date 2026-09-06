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

  it("iki kişisel analiz yüzeyinde de Panoma dön eylemini gösterir", () => {
    for (const page of ["app/panom/katkim/page.tsx", "app/panom/markalar/page.tsx"]) {
      assert.match(source(page), /<Link href="\/panom"[^>]*>Panoma dön<\/Link>/);
    }
  });
});

describe("kapsam açıklamaları", () => {
  it("ana sayfa metriklerini gerçek görev filtrelerine bağlar", () => {
    const home = source("app/page.tsx");
    const tasks = source("app/tasks/page.tsx");
    const listing = source("lib/repositories/taskListing.ts");

    assert.match(home, /href="\/tasks\?focus=open"/);
    assert.match(home, /href="\/tasks\?focus=overdue"/);
    assert.match(home, /href="\/tasks\?focus=week"/);
    assert.match(tasks, /parseTaskFilterParams\(sp\)/);
    // G07 filters the full collection before pagination on the server.
    assert.match(tasks, /listTaskPage\(me\.id, initialFilters/);
    assert.match(listing, /if \(f\.focus\) add\("t\.status!='Yayinlandi'"\)/);
    assert.match(listing, /f\.focus === "overdue"[\s\S]*?add\("t\.due_date<\?", options\.today\)/);
    assert.match(listing, /f\.focus === "week"[\s\S]*?add\("t\.due_date>=\?", options\.today\); add\("t\.due_date<=\?", options\.weekEnd\)/);
  });

  it("guest marka toplamı ile bu hesabın görevlerini açıkça ayırır", () => {
    const guest = source("app/guest/page.tsx");
    assert.match(guest, /MARKANIN TÜM PLANLANMIŞ İŞLERİ/);
    assert.match(guest, /BU HESAPTAN AÇILAN GÖREVLER/);
    assert.match(guest, /aynı kapsam değildir/);
  });
});
