import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";
import { normalizeUsername, usernameLookupKey } from "@/lib/username";

const TMP_DB = path.join(os.tmpdir(), `inturlam-test-username-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const { createPerson, findLoginCandidate, isUsernameTaken, updatePersonUsername } =
  await import("@/lib/repositories/people");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true });
}

beforeEach(resetDb);
after(resetDb);

describe("kullanıcı adı biçimi", () => {
  it("küçük harfe indirger ve kırpar", () => {
    assert.equal(normalizeUsername("  Ada.Yilmaz  "), "ada.yilmaz");
    assert.equal(normalizeUsername("YUNUS"), "yunus");
    assert.equal(normalizeUsername("ada_y-01"), "ada_y-01");
  });

  it("geçersiz biçimleri reddeder", () => {
    assert.equal(normalizeUsername(""), null);
    assert.equal(normalizeUsername(null), null);
    assert.equal(normalizeUsername("ab"), null, "3 karakterden kısa");
    assert.equal(normalizeUsername("a".repeat(33)), null, "32 karakterden uzun");
    assert.equal(normalizeUsername("ada yilmaz"), null, "boşluk");
    assert.equal(normalizeUsername("ada@inturlam"), null, "geçersiz karakter");
    assert.equal(normalizeUsername(".ada"), null, "noktayla başlayamaz");
    // Türkçe harfler bilinçli olarak dışarıda: "İ/ı" katlaması yerele göre
    // değiştiği için benzersizlik kontrolü ortamdan ortama farklı sonuç verirdi.
    assert.equal(normalizeUsername("şila"), null);
    assert.equal(normalizeUsername("ismail_İ"), null);
  });
});

describe("kullanıcı adıyla giriş", () => {
  it("kullanıcı adını büyük/küçük harf ayırmadan çözer", () => {
    getDb();
    const id = createPerson("ada.yilmaz", "Ada Yılmaz", "design", "hash");

    assert.equal(findLoginCandidate("ada.yilmaz")?.id, id);
    assert.equal(findLoginCandidate("  Ada.Yilmaz ")?.id, id);
    assert.equal(findLoginCandidate("Ada Yılmaz")?.id, id, "tam ad yedeği korunuyor");
    assert.equal(findLoginCandidate("bilinmeyen"), undefined);
  });

  it("kullanıcı adı eşleşmesi id ve ad yedeklerinin ÖNÜNDE gelir", () => {
    const db = getDb();
    db.prepare(
      "INSERT INTO people (id, username, name, password_hash) VALUES (?, ?, ?, ?)",
    ).run("eski-kisi", null, "eski-kisi", "hash-a");
    const yeni = createPerson("eski-kisi", "Yeni Kişi", null, "hash-b");

    // "eski-kisi" hem birinin id'si hem de ötekinin kullanıcı adı. Kullanıcı
    // adı ATANABİLİR bir alan olduğu için giriş onu alana gitmeli.
    assert.equal(findLoginCandidate("eski-kisi")?.id, yeni);
  });

  it("kullanıcı adı değiştirilebilir ve benzersizliği korunur", () => {
    getDb();
    const ada = createPerson("ada.yilmaz", "Ada Yılmaz", null, "hash");
    createPerson("bora.kaya", "Bora Kaya", null, "hash");

    assert.equal(isUsernameTaken("bora.kaya"), true);
    assert.equal(isUsernameTaken("ada.yilmaz", ada), false, "kendi adı çakışma değil");
    assert.equal(isUsernameTaken("bos.ad"), false);

    updatePersonUsername(ada, "ada.y");
    assert.equal(findLoginCandidate("ada.y")?.id, ada);
    assert.equal(findLoginCandidate("ada.yilmaz"), undefined, "eski ad artık geçmez");

    // Son savunma DB'de: aynı kullanıcı adı ikinci kez yazılamaz.
    assert.throws(() => updatePersonUsername(ada, "bora.kaya"), /UNIQUE|constraint/i);
  });
});

describe("kullanıcı adı arama anahtarı", () => {
  it("boş girdide anahtar üretmez", () => {
    assert.equal(usernameLookupKey("   "), null);
    assert.equal(usernameLookupKey(null), null);
    assert.equal(usernameLookupKey(" Yunus "), "yunus");
  });
});
