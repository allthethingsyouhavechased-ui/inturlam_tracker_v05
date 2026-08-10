// Ortak gönderi (collab) çözümlemesi: bir gönderi hem sahibi hem de ortak
// yazarları (coauthorProducers) için sayılmalı — yoksa ortak gönderi
// paylaşan taraf hep "hiç paylaşım yapmamış" gibi görünür (gerçek bug,
// 2026-08-10'da tespit edildi: N.S Black Hole, Sihirli Olta ile ortak
// paylaştığı bir gönderide görünmez kalmıştı).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveHandlesForItem } from "@/lib/social/apify";

describe("resolveHandlesForItem", () => {
  it("yalnızca sahibi olan normal gönderide tek handle döner", () => {
    assert.deepEqual(resolveHandlesForItem({ ownerUsername: "Marka" }), ["marka"]);
  });

  it("ortak gönderide sahip + tüm ortak yazarları döner", () => {
    const handles = resolveHandlesForItem({
      ownerUsername: "sihirliolta",
      coauthorProducers: [{ username: "NS.BlackHole" }],
    });
    assert.deepEqual(handles.sort(), ["ns.blackhole", "sihirliolta"]);
  });

  it("sahip ile ortak yazar aynıysa (büyük/küçük harf farkı) tekilleştirir", () => {
    const handles = resolveHandlesForItem({
      ownerUsername: "marka",
      coauthorProducers: [{ username: "MARKA" }],
    });
    assert.deepEqual(handles, ["marka"]);
  });

  it("ownerUsername yoksa username'e düşer", () => {
    assert.deepEqual(resolveHandlesForItem({ username: "Yedek" }), ["yedek"]);
  });

  it("kullanıcı adı olmayan ortak yazarı yok sayar", () => {
    const handles = resolveHandlesForItem({
      ownerUsername: "marka",
      coauthorProducers: [{}, { username: "" }, { username: "gercekortak" }],
    });
    assert.deepEqual(handles.sort(), ["gercekortak", "marka"]);
  });

  it("hiçbir kullanıcı adı yoksa boş dizi döner", () => {
    assert.deepEqual(resolveHandlesForItem({}), []);
  });
});
