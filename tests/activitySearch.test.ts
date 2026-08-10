import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterActivityEntries } from "@/lib/activitySearch";
import type { ActivityEntry } from "@/lib/types";

const entries: ActivityEntry[] = [
  {
    id: "a1",
    actor_id: "p1",
    actor_name: "Sıla",
    actor_avatar_path: null,
    action: "task_updated",
    entity_type: "task",
    entity_id: "t1",
    brand_id: "b1",
    summary: "İstanbul çekimi teslim tarihini değiştirdi",
    created_at: "2026-08-06 10:00:00",
  },
  {
    id: "a2",
    actor_id: "p2",
    actor_name: "Özgür",
    actor_avatar_path: null,
    action: "brand_created",
    entity_type: "brand",
    entity_id: "b2",
    brand_id: "b2",
    summary: "Yeni marka oluşturdu",
    created_at: "2026-08-06 09:00:00",
  },
];

describe("filterActivityEntries", () => {
  it("boş sorguda listeyi değiştirmiyor", () => {
    assert.deepEqual(filterActivityEntries(entries, "   "), entries);
  });

  it("kişi ve özet alanlarında Türkçe harflerle arıyor", () => {
    assert.deepEqual(filterActivityEntries(entries, "SILA").map((entry) => entry.id), ["a1"]);
    assert.deepEqual(filterActivityEntries(entries, "istanbul").map((entry) => entry.id), ["a1"]);
    assert.deepEqual(filterActivityEntries(entries, "özgür").map((entry) => entry.id), ["a2"]);
  });

  it("eşleşmeyen sorguda boş liste dönüyor", () => {
    assert.deepEqual(filterActivityEntries(entries, "takvim"), []);
  });
});
