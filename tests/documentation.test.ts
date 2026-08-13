import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("v03 teknik dokümantasyonu", () => {
  it("README v03 çalışma sözleşmesini ve doğru runtime yollarını anlatır", () => {
    const readme = source("README.md");
    assert.match(readme, /^# İNTURLAM Tracker v03/m);
    assert.match(readme, /http:\/\/localhost:3001/);
    assert.match(readme, /data\/uploads/);
    assert.match(readme, /docs\/v03-local-setup\.md/);
    assert.match(readme, /Görev teslim tarihleri etkinlik takviminde gösterilmez/);
    assert.match(readme, /Görev şablonları/);
    assert.doesNotMatch(readme, /inturlam_tracker_v02\.git/);
    assert.doesNotMatch(readme, /public\/uploads/);
  });

  it("yerel kurulum belgesi izolasyon, doğrulama ve Google test takvimi akışını kapsar", () => {
    const setup = source("docs/v03-local-setup.md");
    for (const fragment of [
      "npm run db:backup",
      "npm run uploads:audit",
      "npm run smoke:local",
      "Inturlam Tracker v03 Calendar Sync",
      "GOOGLE_CALENDAR_ID",
      "upstream-v02",
    ]) assert.ok(setup.includes(fragment), `${fragment} kurulum belgesinde bulunmalı`);
    assert.match(setup, /db:seed[\s\S]*çalıştırmayın/i);
    assert.match(setup, /db:clear-work[\s\S]*çalıştırmayın/i);
  });

  it("ofis belgesi güvenli v03 güncellemesini veri silmeden ve ayrı cutover ile açıklar", () => {
    const office = source("OFIS-GUNCELLEME.md");
    assert.match(office, /v03 → v03/);
    assert.match(office, /v02 → v03/);
    assert.match(office, /data\/uploads/);
    assert.match(office, /PRAGMA integrity_check/);
    assert.match(office, /aynı anda yazılamaz/i);
    assert.doesNotMatch(office, /npm run db:clear-work/);
    assert.doesNotMatch(office, /public\/uploads/);
  });

  it("geliştirici notları v03 kimlik, runtime ve port sözleşmesini güncel tutar", () => {
    const claude = source("CLAUDE.md");
    assert.match(claude, /inturlam_v03_session/);
    assert.match(claude, /account_sessions/);
    assert.match(claude, /TeamActor \| GuestActor/);
    assert.match(claude, /next start -H 0\.0\.0\.0 -p 3001/);
    assert.doesNotMatch(claude, /next start -H 0\.0\.0\.0 -p 3000/);
  });
});

describe("v03 kullanım kılavuzu", () => {
  it("ekip ve guest akışlarının ürün kurallarını doğru anlatır", () => {
    const guide = source("KULLANIM-KILAVUZU.md");
    for (const fragment of [
      "Ekip girişi",
      "Guest girişi",
      "İstenen tarih",
      "Planlanacak",
      "Ağırlık puanı",
      "Görev şablonları",
      "Aylık içerikler tamamlandı",
      "Guest ile paylaş",
      "Fikir Bankası",
    ]) assert.ok(guide.includes(fragment), `${fragment} kullanım kılavuzunda bulunmalı`);
    assert.match(guide, /Görev teslim tarihleri[\s\S]*takvimde gösterilmez/i);
    assert.match(guide, /ekip[\s\S]*teslim tarihi[\s\S]*zorunlu/i);
    assert.doesNotMatch(guide, /Takvim[^\n]*Görevleri teslim tarihine göre/);
    assert.doesNotMatch(guide, /Şablonlar v02.*kaldırıldı/);
    assert.doesNotMatch(guide, /teslim tarihini \(son ikisi opsiyonel\)/);
  });

  it("yerel Markdown bağlantıları var olan dosyalara gider", () => {
    for (const documentPath of ["README.md", "docs/v03-local-setup.md", "OFIS-GUNCELLEME.md", "KULLANIM-KILAVUZU.md"]) {
      const document = source(documentPath);
      const links = [...document.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
        .map((match) => match[1])
        .filter((target) => !/^(?:https?:|#)/.test(target));
      for (const target of links) {
        const withoutAnchor = target.split("#", 1)[0];
        const absolute = resolve(process.cwd(), dirname(documentPath), decodeURIComponent(withoutAnchor));
        assert.equal(existsSync(absolute), true, `${documentPath}: ${target} bulunamadı`);
      }
    }
  });
});
