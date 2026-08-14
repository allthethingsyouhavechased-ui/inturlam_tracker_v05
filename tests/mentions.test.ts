// @mention ayrıştırma (lib/mentions.ts) — saf fonksiyonlar, DB yok. Aynı
// mantık hem bildirim oluşturmada (kim bildirim alır) hem de yorum metninde
// vurgulamada (ne vurgulanır) kullanıldığı için buradaki her kural iki yeri
// birden etkiler.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractMentionedPeople, findMentionMatches } from "@/lib/mentions";
import type { Person } from "@/lib/types";

function person(id: string, name: string): Person {
  return {
    id,
    username: id,
    name,
    title: null,
    bio: null,
    avatar_path: null,
    department: null,
    is_manager: 0,
    active: 1,
  };
}

const CANSU = person("cansu", "Cansu");
const YUNUS_EMRE = person("yunus", "Yunus Emre");
const SILA = person("sila", "Sıla");
const IREM = person("irem", "İrem");

describe("extractMentionedPeople", () => {
  it("tam eşleşme: tek kelimelik isim", () => {
    const result = extractMentionedPeople("Bu işi @Cansu kontrol etsin.", [
      CANSU,
      YUNUS_EMRE,
    ]);
    assert.deepEqual(result.map((p) => p.id), ["cansu"]);
  });

  it("büyük/küçük harf duyarsız, Türkçe İ/ı dahil", () => {
    // "Sıla" (dotless ı) tamamen büyük harfle yazılmış: ASCII/locale'siz
    // toLowerCase "I"yı "i" yapar, oysa Türkçe'de büyük "I"nın küçüğü "ı"dır.
    assert.deepEqual(
      extractMentionedPeople("@SILA bakar mısın?", [SILA]).map((p) => p.id),
      ["sila"],
    );
    // "İrem" (noktalı büyük İ) küçük harfle, düz "i" ile yazılmış: locale'siz
    // toLowerCase "İ"yi "i" + birleşen nokta işaretine çevirip düz "i" ile
    // eşleşmeyi kaçırır (aynı hata sınıfı: lib/repositories/search.ts, commit
    // d124eb0 — "İSTANBUL"/"istanbul").
    assert.deepEqual(
      extractMentionedPeople("Bu görevi @irem yapsın", [IREM]).map((p) => p.id),
      ["irem"],
    );
  });

  it("çok kelimeli isim bütün olarak eşleşir, kısa önek ayrı kişiye bağlanmaz", () => {
    const YUNUS_SOLO = person("yunus-solo", "Yunus");
    const result = extractMentionedPeople("@Yunus Emre bu görevi devralsın.", [
      YUNUS_EMRE,
      YUNUS_SOLO,
    ]);
    // En uzun isim ("Yunus Emre") önce denendiği ve o aralığı "claim" ettiği
    // için kısa "Yunus" adı aynı metinde ikinci bir kişi olarak eşleşmez.
    assert.deepEqual(result.map((p) => p.id), ["yunus"]);
  });

  it("daha uzun bir kelimenin öneki yanlışlıkla eşleşmiyor", () => {
    const YUNUS_SOLO = person("yunus-solo", "Yunus");
    const result = extractMentionedPeople("@Yunusxyz diye biri yok burada.", [
      YUNUS_SOLO,
    ]);
    assert.deepEqual(result, []);
  });

  it("mention içermeyen metinde sonuç boş", () => {
    const result = extractMentionedPeople("Bugün çekim var, herkese kolay gelsin.", [
      CANSU,
      YUNUS_EMRE,
    ]);
    assert.deepEqual(result, []);
  });

  it("aynı kişi iki kez bahsedilse de tek kez döner", () => {
    const result = extractMentionedPeople(
      "@Cansu bakar mısın? @Cansu bu acil, lütfen bugün bak.",
      [CANSU],
    );
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "cansu");
  });
});

describe("findMentionMatches", () => {
  it("eşleşmenin metindeki konumunu (start/end) doğru döner", () => {
    const body = "Merhaba @Cansu, bakar mısın?";
    const matches = findMentionMatches(body, [CANSU]);
    assert.equal(matches.length, 1);
    assert.equal(body.slice(matches[0].start, matches[0].end), "@Cansu");
  });

  it("birden çok eşleşmeyi metindeki sırayla döner", () => {
    const body = "@Cansu ve @Yunus Emre birlikte baksın.";
    const matches = findMentionMatches(body, [CANSU, YUNUS_EMRE]);
    assert.deepEqual(matches.map((m) => m.person.id), ["cansu", "yunus"]);
  });
});
