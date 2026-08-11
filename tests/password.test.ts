import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hashPassword,
  validatePassword,
  verifyPassword,
} from "@/lib/auth/password";

describe("şifre güvenliği", () => {
  it("şifreyi düz metin saklamadan doğrular", () => {
    const password = "Ajans-2026";
    const stored = hashPassword(password);

    assert.notEqual(stored, password);
    assert.equal(stored.includes(password), false);
    assert.equal(verifyPassword(password, stored), true);
    assert.equal(verifyPassword("yanlış-şifre", stored), false);
  });

  it("aynı şifreyi farklı salt ile farklı özetler", () => {
    assert.notEqual(hashPassword("Ajans-2026"), hashPassword("Ajans-2026"));
  });

  it("bozuk özetleri reddeder ve şifre uzunluğunu denetler", () => {
    assert.equal(verifyPassword("deneme", "bozuk"), false);
    assert.match(validatePassword("1234567") ?? "", /en az 8/);
    assert.equal(validatePassword("12345678"), null);
  });
});
