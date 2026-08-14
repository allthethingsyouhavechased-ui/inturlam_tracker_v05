import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldUseSecureCookie } from "@/lib/auth/cookieSecurity";

// Denetim bulgusu SEC-01: oturum çerezinde `secure` bayrağı hiç yoktu, yani
// HTTPS arkasında bile token düz metin bir isteğe düşebiliyordu. Bayrak sabit
// `true` de olamaz — LAN dağıtımı düz HTTP ve o zaman hiç kimse giriş yapamaz.

describe("oturum çerezi secure bayrağı", () => {
  it("proxy HTTPS bildirince açılır", () => {
    assert.equal(shouldUseSecureCookie("https", undefined), true);
    assert.equal(shouldUseSecureCookie("HTTPS", undefined), true);
    // Zincirlenmiş proxy: istemciye en yakın olan İLK değer belirler.
    assert.equal(shouldUseSecureCookie("https, http", undefined), true);
  });

  it("düz HTTP LAN kurulumunda kapalı kalır (giriş bozulmasın)", () => {
    assert.equal(shouldUseSecureCookie("http", undefined), false);
    assert.equal(shouldUseSecureCookie(null, undefined), false);
    assert.equal(shouldUseSecureCookie(undefined, undefined), false);
    assert.equal(shouldUseSecureCookie("http, https", undefined), false);
  });

  it("env ile her iki yönde elle kontrol edilebilir", () => {
    // Başlığı iletmeyen bir proxy'nin arkasında otomatik tespit çalışmaz.
    assert.equal(shouldUseSecureCookie(null, "1"), true);
    assert.equal(shouldUseSecureCookie(null, "true"), true);
    assert.equal(shouldUseSecureCookie(null, "always"), true);
    assert.equal(shouldUseSecureCookie("https", "0"), false);
    assert.equal(shouldUseSecureCookie("https", "never"), false);
    // Tanınmayan değer override sayılmaz, otomatik tespite düşer.
    assert.equal(shouldUseSecureCookie("https", "belki"), true);
    assert.equal(shouldUseSecureCookie("http", "belki"), false);
  });
});
