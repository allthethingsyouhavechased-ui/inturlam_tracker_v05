import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LoginThrottle } from "@/lib/auth/loginThrottle";

describe("giriş deneme sınırı", () => {
  it("beş hatadan sonra hesabı pencere bitene kadar bekletir", () => {
    const throttle = new LoginThrottle(5, 1_000);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      throttle.recordFailure("yunus", 100);
      assert.equal(throttle.isBlocked("yunus", 100), false);
    }
    throttle.recordFailure("yunus", 100);
    assert.equal(throttle.isBlocked("yunus", 999), true);
    assert.equal(throttle.isBlocked("yunus", 1_100), false);
  });

  it("başarılı girişte sayacı temizler ve hesapları birbirinden ayırır", () => {
    const throttle = new LoginThrottle(2, 1_000);
    throttle.recordFailure("a", 0);
    throttle.recordFailure("a", 0);
    throttle.recordFailure("b", 0);
    assert.equal(throttle.isBlocked("a", 1), true);
    assert.equal(throttle.isBlocked("b", 1), false);
    throttle.reset("a");
    assert.equal(throttle.isBlocked("a", 1), false);
  });
});
