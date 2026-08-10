// Üst menü verisi ve saf yardımcıları. Sosyal'in alt sayfalarla açılır menüye
// dönüşmesiyle iki renderer (NavLinks, SidebarNavLinks) arasında href
// çakışması/kopyası kolayca sızabilir — burada kilitleniyor.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MAIN_NAV, isNavActive, visibleNav } from "@/lib/nav";

function allHrefs(items: readonly { href: string; children?: readonly { href: string }[] }[]): string[] {
  return items.flatMap((item) => [item.href, ...(item.children ?? []).map((c) => c.href)]);
}

describe("visibleNav", () => {
  it("yönetici değilse Raporlar'ı eler, sırayı korur", () => {
    const withReports = visibleNav(true);
    const withoutReports = visibleNav(false);
    assert.ok(withReports.some((item) => item.href === "/reports"));
    assert.ok(!withoutReports.some((item) => item.href === "/reports"));
    assert.equal(withoutReports.length, withReports.length - 1);
    assert.deepEqual(
      withoutReports.map((item) => item.href),
      withReports.map((item) => item.href).filter((href) => href !== "/reports"),
    );
  });
});

describe("MAIN_NAV yapısı", () => {
  it("tüm href'ler (üst + alt) tekildir", () => {
    const hrefs = allHrefs(MAIN_NAV);
    assert.equal(new Set(hrefs).size, hrefs.length);
  });

  it("Sosyal tam 3 alt sayfa taşır, her birinin href'i ebeveynin öneki", () => {
    const social = MAIN_NAV.find((item) => item.href === "/social");
    assert.ok(social?.children);
    assert.equal(social.children.length, 3);
    for (const child of social.children) {
      assert.ok(child.href.startsWith("/social/"), child.href);
    }
    assert.deepEqual(
      social.children.map((c) => c.href),
      ["/social/takip", "/social/varlik", "/social/takvim"],
    );
  });

  it("Sosyal dışındaki öğelerin çocuğu yok", () => {
    for (const item of MAIN_NAV) {
      if (item.href === "/social") continue;
      assert.equal(item.children, undefined, item.href);
    }
  });
});

describe("isNavActive", () => {
  it("tam eşleşmeyi aktif sayar", () => {
    assert.equal(isNavActive("/social", "/social"), true);
  });

  it("alt rotayı aktif sayar", () => {
    assert.equal(isNavActive("/social/takvim", "/social"), true);
  });

  it("benzer ama alakasız bir yolu aktif SAYMAZ (eski çıplak startsWith'in bug'ı)", () => {
    assert.equal(isNavActive("/socialmedia", "/social"), false);
  });

  it("alakasız bir yolu aktif saymaz", () => {
    assert.equal(isNavActive("/tasks", "/social"), false);
  });
});
