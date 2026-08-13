// Liste görünümündeki sütun sıralaması. Alfabetik DEĞİL, anlamlı sıralama
// (Acil→Düşük, Beklemede→Yayınlandı) ve "değeri olmayan satır her zaman sonda"
// kuralı kolayca bozulabilecek şeyler — burada kilitleniyor.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextSort, sortTasksForList, type ListSort } from "@/lib/taskSort";
import type { TaskPriority, TaskStatus, TaskWithContext } from "@/lib/types";

let counter = 0;
function task(over: Partial<TaskWithContext> = {}): TaskWithContext {
  counter += 1;
  return {
    id: `t${counter}`,
    content_item_id: "c1",
    title: `Görev ${counter}`,
    status: "Beklemede" as TaskStatus,
    priority: "Normal" as TaskPriority,
    difficulty: "Orta",
    assignee_id: null,
    due_date: null,
    notes: null,
    weight_points: 1,
    origin: "team",
    requested_date: null,
    guest_brief: null,
    created_by_account_id: null,
    repeat_days: null,
    completed_at: null,
    completed_by: null,
    archived_at: null,
    created_at: "2026-07-01 10:00:00",
    updated_at: "2026-07-01 10:00:00",
    assignee_name: "Arman",
    assignee_avatar_path: null,
    content_title: "Ağustos Reel Serisi",
    content_type: "Reel",
    brand_id: "b1",
    brand_name: "Sihirli Olta",
    comment_count: 0,
    last_comment_body: null,
    last_comment_author: null,
    revision_count: 0,
    active_revision_id: null,
    active_revision_started_at: null,
    active_revision_target_minutes: null,
    active_revision_elapsed_minutes: null,
    total_revision_minutes: 0,
    personal_target_date: null,
    ...over,
  };
}

const asc = (key: ListSort["key"]): ListSort => ({ key, dir: "asc" });
const desc = (key: ListSort["key"]): ListSort => ({ key, dir: "desc" });

describe("sortTasksForList", () => {
  it("öncelik: artan = Acil önce (alfabetik değil)", () => {
    const rows = [
      task({ priority: "Normal" }),
      task({ priority: "Dusuk" }),
      task({ priority: "Acil" }),
      task({ priority: "Yuksek" }),
    ];
    assert.deepEqual(
      sortTasksForList(rows, asc("oncelik")).map((t) => t.priority),
      ["Acil", "Yuksek", "Normal", "Dusuk"],
    );
    assert.deepEqual(
      sortTasksForList(rows, desc("oncelik")).map((t) => t.priority),
      ["Dusuk", "Normal", "Yuksek", "Acil"],
    );
  });

  it("durum: iş akışı sırası, alfabetik değil", () => {
    const rows = [
      task({ status: "Yayinlandi" }),
      task({ status: "Beklemede" }),
      task({ status: "Onaylandi" }),
      task({ status: "DevamEdiyor" }),
      task({ status: "Incelemede" }),
    ];
    assert.deepEqual(
      sortTasksForList(rows, asc("durum")).map((t) => t.status),
      ["Beklemede", "DevamEdiyor", "Incelemede", "Onaylandi", "Yayinlandi"],
    );
  });

  it("zorluk: Zor → Orta → Kolay sıralar, Özel'i ayrı ve sonda tutar", () => {
    const rows = [
      task({ difficulty: "Kolay" }),
      task({ difficulty: "Ozel" }),
      task({ difficulty: "Zor" }),
      task({ difficulty: "Orta" }),
    ];
    assert.deepEqual(
      sortTasksForList(rows, asc("zorluk")).map((t) => t.difficulty),
      ["Zor", "Orta", "Kolay", "Ozel"],
    );
  });

  it("teslim: tarihsiz satırlar İKİ yönde de sonda", () => {
    const rows = [
      task({ due_date: null }),
      task({ due_date: "2026-08-01" }),
      task({ due_date: "2026-07-20" }),
    ];
    assert.deepEqual(
      sortTasksForList(rows, asc("teslim")).map((t) => t.due_date),
      ["2026-07-20", "2026-08-01", null],
    );
    assert.deepEqual(
      sortTasksForList(rows, desc("teslim")).map((t) => t.due_date),
      ["2026-08-01", "2026-07-20", null],
    );
  });

  it("hedef: kişisel hedefi tarihe göre sıralıyor, hedefsizler iki yönde de sonda", () => {
    const rows = [
      task({ personal_target_date: null }),
      task({ personal_target_date: "2026-08-12" }),
      task({ personal_target_date: "2026-08-07" }),
    ];
    assert.deepEqual(
      sortTasksForList(rows, asc("hedef")).map((t) => t.personal_target_date),
      ["2026-08-07", "2026-08-12", null],
    );
    assert.deepEqual(
      sortTasksForList(rows, desc("hedef")).map((t) => t.personal_target_date),
      ["2026-08-12", "2026-08-07", null],
    );
  });

  it("tür: ekranda görünen Türkçe tür etiketine göre sıralıyor", () => {
    const rows = [
      task({ content_type: "Story" }),
      task({ content_type: "Reel" }),
      task({ content_type: "Foto" }),
      task({ content_type: "Post" }),
    ];
    assert.deepEqual(
      sortTasksForList(rows, asc("tur")).map((t) => t.content_type),
      ["Foto", "Post", "Reel", "Story"],
    );
  });

  it("yorum: artan = en çok konuşulan önce, yorumsuzlar İKİ yönde de sonda", () => {
    const rows = [
      task({ comment_count: 0 }),
      task({ comment_count: 2 }),
      task({ comment_count: 7 }),
    ];
    // "asc" burada sayısal artan DEĞİL: kullanıcı bu sütuna tıklarken
    // "hangi görevde trafik var" diye bakıyor, en boş olana değil.
    assert.deepEqual(
      sortTasksForList(rows, asc("yorum")).map((t) => t.comment_count),
      [7, 2, 0],
    );
    assert.deepEqual(
      sortTasksForList(rows, desc("yorum")).map((t) => t.comment_count),
      [2, 7, 0],
    );
  });

  it("atanan: atanmamışlar İKİ yönde de sonda", () => {
    const rows = [
      task({ assignee_name: null }),
      task({ assignee_name: "Zeynep" }),
      task({ assignee_name: "Arman" }),
    ];
    assert.deepEqual(
      sortTasksForList(rows, asc("atanan")).map((t) => t.assignee_name),
      ["Arman", "Zeynep", null],
    );
    assert.deepEqual(
      sortTasksForList(rows, desc("atanan")).map((t) => t.assignee_name),
      ["Zeynep", "Arman", null],
    );
  });

  it("marka: aynı markanın görevleri alt alta, kendi içinde projeye göre", () => {
    const rows = [
      task({ brand_name: "Tersan Marine", content_title: "Fuar" }),
      task({ brand_name: "Alaaddin Hamam", content_title: "Tanıtım" }),
      task({ brand_name: "Tersan Marine", content_title: "Ajanda" }),
      task({ brand_name: "Alaaddin Hamam", content_title: "Menü" }),
    ];
    const sorted = sortTasksForList(rows, asc("marka"));
    assert.deepEqual(sorted.map((t) => `${t.brand_name}/${t.content_title}`), [
      "Alaaddin Hamam/Menü",
      "Alaaddin Hamam/Tanıtım",
      "Tersan Marine/Ajanda",
      "Tersan Marine/Fuar",
    ]);
  });

  it("Türkçe sıralama: ç/ı/ö/ş/ü doğru yerde", () => {
    const rows = [
      task({ title: "Çekim" }),
      task({ title: "Brief" }),
      task({ title: "Şablon" }),
      task({ title: "Sunum" }),
    ];
    assert.deepEqual(
      sortTasksForList(rows, asc("gorev")).map((t) => t.title),
      ["Brief", "Çekim", "Sunum", "Şablon"],
    );
  });

  it("girdi dizisini değiştirmiyor", () => {
    const rows = [task({ priority: "Dusuk" }), task({ priority: "Acil" })];
    const before = rows.map((t) => t.id);
    sortTasksForList(rows, asc("oncelik"));
    assert.deepEqual(rows.map((t) => t.id), before);
  });
});

describe("nextSort", () => {
  it("artan → azalan → varsayılan döngüsü", () => {
    const first = nextSort(null, "marka");
    assert.deepEqual(first, { key: "marka", dir: "asc" });
    const second = nextSort(first, "marka");
    assert.deepEqual(second, { key: "marka", dir: "desc" });
    assert.equal(nextSort(second, "marka"), null);
  });

  it("başka sütuna tıklayınca artandan başlar", () => {
    assert.deepEqual(nextSort({ key: "marka", dir: "desc" }, "teslim"), {
      key: "teslim",
      dir: "asc",
    });
  });
});
