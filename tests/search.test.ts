// Global arama (header'daki kutu + /search). SQLite'ın `LIKE ... COLLATE
// NOCASE`'i yalnızca ASCII a-z/A-Z'yi katlıyor — küçük harfle "şantiye" ya da
// "çekim" aratan biri hiç sonuç bulamıyordu. Bu, sessizce yanlış olan ve fark
// edilmesi zor bir hata sınıfı; burada kilitleniyor.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-search-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const { searchAll } = await import("@/lib/repositories/search");

before(() => {
  const db = getDb();
  db.prepare("INSERT INTO brands (id, name, cluster) VALUES (?,?,?)").run(
    "b1", "Şantiye Market", "tek",
  );
  db.prepare(
    "INSERT INTO content_items (id, brand_id, title, type) VALUES (?,?,?,?)",
  ).run("c1", "b1", "İstanbul Kampanyası", "Kampanya");
  db.prepare(
    "INSERT INTO tasks (id, content_item_id, title, notes) VALUES (?,?,?,?)",
  ).run("t1", "c1", "Çekim planı", "Işık ekibiyle konuş");
  db.prepare(
    `INSERT INTO ideas
      (id, scope_type, brand_id, brand_name_snapshot, category, title, body, tags_text, created_by_name)
     VALUES (?,?,?,?,?,?,?,?,?)`,
  ).run("i1", "brand", "b1", "Şantiye Market", "Icerik", "Sessiz ürün videosu", "Ürün seslerinden ritim", "ilham, kurgu", "Ayşe");
});

after(() => {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) {
    fs.rmSync(TMP_DB + suffix, { force: true });
  }
});

describe("searchAll — Türkçe büyük/küçük harf", () => {
  it("küçük harfle 'şantiye' markayı buluyor", () => {
    assert.equal(searchAll("şantiye").brands.length, 1);
    assert.equal(searchAll("ŞANTİYE").brands.length, 1);
  });

  it("küçük harfle 'istanbul' içeriği buluyor (İ/i eşleşmesi)", () => {
    assert.equal(searchAll("istanbul").content.length, 1);
    assert.equal(searchAll("İSTANBUL").content.length, 1);
  });

  it("küçük harfle 'çekim' görevi buluyor", () => {
    assert.equal(searchAll("çekim").tasks.length, 1);
    assert.equal(searchAll("ÇEKİM").tasks.length, 1);
  });

  it("notlarda da arıyor", () => {
    assert.equal(searchAll("ışık").tasks.length, 1);
  });

  it("fikir başlığı, açıklaması, etiketi ve marka bağlamında arıyor", () => {
    assert.equal(searchAll("sessiz").ideas.length, 1);
    assert.equal(searchAll("ritim").ideas.length, 1);
    assert.equal(searchAll("ilham").ideas.length, 1);
    assert.equal(searchAll("şantiye").ideas.length, 1);
  });

  it("boş sorguda hiçbir şey döndürmüyor", () => {
    const r = searchAll("   ");
    assert.deepEqual(r, { brands: [], content: [], tasks: [], ideas: [] });
  });
});
