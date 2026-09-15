// "Beni hatırla": sunucudaki oturum süresi ile çerez ömrü AYNI değerden
// türemeli. İkisi ayrışırsa ya kullanıcı elinde ölü çerezle çıkış yapmış gibi
// görünür, ya da sunucuda çerezden uzun yaşayan bir oturum kalır.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SESSION_TTL_SECONDS,
  rememberMeTtlSeconds,
  sessionTtlSeconds,
} from "@/lib/auth/constants";

describe("oturum süresi", () => {
  it("beni hatırla seçilmezse mevcut 12 saatlik davranış korunuyor", () => {
    assert.equal(sessionTtlSeconds(false), SESSION_TTL_SECONDS);
    assert.equal(SESSION_TTL_SECONDS, 12 * 60 * 60);
  });

  it("beni hatırla seçilirse varsayılan 30 gün", () => {
    assert.equal(sessionTtlSeconds(true), 30 * 24 * 60 * 60);
  });

  it("ortam değişkeni gün cinsinden süreyi değiştiriyor", () => {
    assert.equal(rememberMeTtlSeconds("7"), 7 * 24 * 60 * 60);
    assert.equal(rememberMeTtlSeconds("180"), 180 * 24 * 60 * 60);
  });

  it("geçersiz veya sınır dışı değerde varsayılana düşüyor", () => {
    for (const value of ["", "0", "-5", "abc", "999", "1.5.2", undefined]) {
      assert.equal(rememberMeTtlSeconds(value), 30 * 24 * 60 * 60, `değer: ${value}`);
    }
  });
});
