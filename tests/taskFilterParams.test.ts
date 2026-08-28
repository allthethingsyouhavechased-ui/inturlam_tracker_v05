import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPTY_TASK_FILTERS,
  parseTaskFilterParams,
  taskFilterSearch,
} from "@/lib/taskFilterParams";

// Gerçek davranış testi — kaynak koda regex atan türden DEĞİL. Filtreler artık
// adres çubuğunda taşındığı için burada kilitlenen şey şu: kullanıcı adres
// çubuğuna ne yazarsa yazsın liste GEÇERLİ bir durumda açılmalı.

describe("görev filtrelerini URL'den okuma", () => {
  it("tanınmayan her değeri sessizce filtresize düşürür", () => {
    const parsed = parseTaskFilterParams({
      status: "HicBoyleBirDurumYok",
      priority: "çok-acil",
      difficulty: "imkansiz",
      due: "yarin",
      from: "13/08/2026",
      to: "",
      department: "muhasebe",
      focus: "anything",
      sort: "rastgele",
    });

    assert.deepEqual(parsed, EMPTY_TASK_FILTERS);
  });

  it("geçerli değerleri olduğu gibi taşır", () => {
    const parsed = parseTaskFilterParams({
      status: "Incelemede",
      priority: "Yuksek",
      difficulty: "unset",
      due: "overdue",
      from: "2026-08-01",
      to: "2026-08-31",
      focus: "week",
      q: "kapak",
      sort: "marka",
      brand: "prive",
      assignee: "yunus",
    });

    assert.equal(parsed.status, "Incelemede");
    assert.equal(parsed.priority, "Yuksek");
    assert.equal(parsed.difficulty, "unset");
    assert.equal(parsed.due, "overdue");
    assert.equal(parsed.from, "2026-08-01");
    assert.equal(parsed.to, "2026-08-31");
    assert.equal(parsed.focus, "week");
    assert.equal(parsed.q, "kapak");
    assert.equal(parsed.sort, "marka");
    assert.equal(parsed.brand, "prive");
    assert.equal(parsed.assignee, "yunus");
  });

  it("departmanda yalnızca bilinen id'leri ve 'atanmamış'ı kabul eder", () => {
    assert.equal(parseTaskFilterParams({ department: "social" }).department, "social");
    assert.equal(parseTaskFilterParams({ department: "yok-boyle" }).department, "");
  });

  it("bozuk tarihi atar, ISO tarihi alır", () => {
    assert.equal(parseTaskFilterParams({ from: "2026-8-1" }).from, "");
    assert.equal(parseTaskFilterParams({ from: "2026-08-01" }).from, "2026-08-01");
  });
});

describe("görev filtrelerini URL'e yazma", () => {
  it("hiç filtre yoksa adres çubuğunu temiz bırakır", () => {
    assert.equal(taskFilterSearch(EMPTY_TASK_FILTERS), "");
  });

  it("varsayılan sıralamayı URL'e yazmaz", () => {
    assert.equal(taskFilterSearch({ ...EMPTY_TASK_FILTERS, sort: "varsayilan" }), "");
    assert.equal(taskFilterSearch({ ...EMPTY_TASK_FILTERS, sort: "marka" }), "?sort=marka");
  });

  it("yazma ve okuma birbirinin tersi (gidiş-dönüş kaybı yok)", () => {
    const filters = {
      ...EMPTY_TASK_FILTERS,
      status: "DevamEdiyor" as const,
      priority: "Yuksek" as const,
      due: "week" as const,
      q: "İstanbul çekimi",
      brand: "just-cafe",
      sort: "atanan" as const,
    };
    const search = taskFilterSearch(filters);
    const params = new URLSearchParams(search.slice(1));
    assert.deepEqual(parseTaskFilterParams(Object.fromEntries(params)), filters);
  });

  it("Türkçe arama metnini kodlar", () => {
    const search = taskFilterSearch({ ...EMPTY_TASK_FILTERS, q: "şantiye & çekim" });
    assert.ok(!search.includes(" "), "boşluk kodlanmalı");
    assert.equal(new URLSearchParams(search.slice(1)).get("q"), "şantiye & çekim");
  });
});
