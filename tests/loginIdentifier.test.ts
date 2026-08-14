import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, beforeEach, describe, it } from "node:test";

const TMP_DB = path.join(os.tmpdir(), `inturlam-v03-login-identifier-${process.pid}.db`);
process.env.INTURLAM_DB_PATH = TMP_DB;

const { getDb } = await import("@/lib/db/client");
const peopleRepository = await import("@/lib/repositories/people");

function resetDb(): void {
  globalThis.__inturlamDb?.close();
  globalThis.__inturlamDb = undefined;
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(TMP_DB + suffix, { force: true });
}

function seedPeople(): void {
  const db = getDb();
  const insert = db.prepare(
    "INSERT INTO people (id, name, password_hash, active) VALUES (?, ?, ?, ?)",
  );
  insert.run("yunus", "Yunus Emre", "people-yunus", 1);
  insert.run("ismail", "İsmail Şahin", "people-ismail", 1);
  insert.run("ayrilan", "Ayrılan Kişi", "people-ayrilan", 0);
  insert.run("sifresiz", "Şifresiz Kişi", null, 1);
  insert.run("account-user", "Hesap Kullanıcısı", "eski-people-hash", 1);
  db.prepare(
    `INSERT INTO accounts (id, kind, person_id, password_hash, active)
     VALUES ('team:account-user', 'team', 'account-user', 'guncel-account-hash', 1)`,
  ).run();
}

beforeEach(() => {
  resetDb();
  seedPeople();
});
after(resetDb);

describe("v03 ekip giriş kimliği", () => {
  it("kişi ID'si veya tam adıyla hesabı çözer", () => {
    assert.equal(peopleRepository.findLoginCandidate("yunus")?.id, "yunus");
    assert.equal(peopleRepository.findLoginCandidate("Yunus Emre")?.id, "yunus");
  });

  it("boşlukları, harf boyutunu ve Türkçe harfleri doğru katlar", () => {
    assert.equal(peopleRepository.findLoginCandidate("  YUNUS  ")?.id, "yunus");
    assert.equal(peopleRepository.findLoginCandidate("yunus emre")?.id, "yunus");
    assert.equal(peopleRepository.findLoginCandidate("İSMAİL ŞAHİN")?.id, "ismail");
  });

  it("v03 team hesabındaki güncel şifre özetini kullanır", () => {
    assert.equal(
      peopleRepository.findLoginCandidate("account-user")?.password_hash,
      "guncel-account-hash",
    );
  });

  it("bilinmeyen ve boş kimlikleri reddeder", () => {
    assert.equal(peopleRepository.findLoginCandidate("boyle-biri-yok"), undefined);
    assert.equal(peopleRepository.findLoginCandidate("   "), undefined);
  });

  it("pasif ve şifresiz hesapları jenerik hata için çağırana bırakır", () => {
    assert.equal(peopleRepository.findLoginCandidate("ayrilan")?.active, 0);
    assert.equal(peopleRepository.findLoginCandidate("sifresiz")?.password_hash, null);
  });
});

describe("v03 giriş yüzeyi", () => {
  it("ekip sayfası oturum öncesinde kişi listesini sızdırmaz", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app", "whoami", "team", "page.tsx"),
      "utf8",
    );

    for (const forbidden of ["listLoginPeople", "listActivePeople", "PersonAvatar"]) {
      assert.doesNotMatch(source, new RegExp(forbidden));
    }
  });

  it("ekip formu ID ve şifre ister; kişi seçimi taşımaz", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "components", "IdentityLoginForm.tsx"),
      "utf8",
    );

    assert.match(source, /name="username"/);
    assert.match(source, /name="password"/);
    assert.doesNotMatch(source, /name="personId"/);
  });

  it("ana girişte ekip ve guest ayrımını korur", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "app", "whoami", "page.tsx"),
      "utf8",
    );

    assert.match(source, /href="\/whoami\/team"/);
    assert.match(source, /href="\/whoami\/guest"/);
  });
});
