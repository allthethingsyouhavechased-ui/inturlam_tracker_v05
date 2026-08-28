import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GO_TO_ROUTES, SHORTCUT_GROUPS } from "@/lib/shortcuts";
import { NAV_GROUPS } from "@/lib/nav";

describe("klavye kısayolları", () => {
  it("her git kısayolu gerçek bir rotayı gösteriyor", () => {
    const known = new Set(NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href)));
    for (const [key, target] of Object.entries(GO_TO_ROUTES)) {
      assert.ok(
        known.has(target.href),
        `G+${key.toUpperCase()} → ${target.href} navigasyonda yok; ölü kısayol`,
      );
    }
  });

  it("aynı ikinci tuşu iki hedef paylaşmıyor", () => {
    const keys = Object.keys(GO_TO_ROUTES);
    assert.equal(new Set(keys).size, keys.length);
  });

  it("yardım listesi tüm git kısayollarını gösteriyor", () => {
    const listed = SHORTCUT_GROUPS
      .flatMap((group) => group.items)
      .filter((item) => item.keys[0] === "G")
      .map((item) => item.keys[1]);
    assert.deepEqual(
      listed.sort(),
      Object.keys(GO_TO_ROUTES).map((key) => key.toUpperCase()).sort(),
      "yardım penceresi ile gerçek kısayollar ayrışmış",
    );
  });
});
