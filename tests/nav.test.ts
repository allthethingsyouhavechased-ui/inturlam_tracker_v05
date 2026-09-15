import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  NAV_GROUPS,
  isNavActive,
  routeContextForPathname,
  visibleNavGroups,
  type NavItem,
} from "@/lib/nav";

function allHrefs(groups: readonly { items: readonly NavItem[] }[]): string[] {
  return groups.flatMap((group) => group.items.map((item) => item.href));
}

describe("visibleNavGroups", () => {
  it("yönetici değilse Raporlar'ı eler, ürün gruplarını korur", () => {
    const withReports = visibleNavGroups(true, true);
    const withoutReports = visibleNavGroups(false, true);
    const withHrefs = allHrefs(withReports);
    const withoutHrefs = allHrefs(withoutReports);
    assert.ok(withHrefs.includes("/reports"));
    assert.ok(!withoutHrefs.includes("/reports"));
    // Alt rotalar da (ör. /reports/puan) aynı yetkiye bağlı; nav'da sızmamalı.
    assert.ok(withHrefs.includes("/reports/puan"));
    assert.ok(!withoutHrefs.some((href) => href.startsWith("/reports")));
    assert.equal(withoutHrefs.length, withHrefs.length - 2);
    assert.equal(withoutReports.length, withReports.length);
  });

  it("talep yetkisi yoksa Talepler bağlantısını gizler", () => {
    const hrefs = allHrefs(visibleNavGroups(true, false));
    assert.ok(!hrefs.includes("/requests"));
    assert.ok(hrefs.includes("/reports"));
  });
});

describe("NAV_GROUPS bilgi mimarisi", () => {
  it("tüm global hedefler tekildir", () => {
    const hrefs = allHrefs(NAV_GROUPS);
    assert.equal(new Set(hrefs).size, hrefs.length);
  });

  it("Bugün, Panom ve Görevler çalışma grubundadır", () => {
    const calisma = NAV_GROUPS.find((group) => group.id === "calisma");
    assert.ok(calisma);
    assert.deepEqual(
      calisma.items.map((item) => item.href),
      ["/", "/panom", "/tasks"],
    );
  });

  it("Takvim organizasyon grubunda, Ekip'in hemen altındadır", () => {
    const organizasyon = NAV_GROUPS.find((group) => group.id === "organizasyon");
    assert.ok(organizasyon);
    const hrefs = organizasyon.items.map((item) => item.href);
    assert.equal(hrefs.indexOf("/calendar"), hrefs.indexOf("/team") + 1);
  });

  it("Puanlar ve Talepler organizasyonda Raporlar'ın hemen altındadır", () => {
    const organizasyon = NAV_GROUPS.find((group) => group.id === "organizasyon");
    assert.ok(organizasyon);
    assert.deepEqual(
      organizasyon.items.map((item) => item.href),
      ["/team", "/calendar", "/reports", "/reports/puan", "/requests", "/activity"],
    );
  });

  it("Markalar, Sosyal ve Fikir Bankası portföydedir; marka ağacı global navda değildir", () => {
    const portfoy = NAV_GROUPS.find((group) => group.id === "portfoy");
    assert.ok(portfoy);
    assert.deepEqual(portfoy.items.map((item) => item.href), ["/brands", "/social", "/ideas"]);
    assert.equal(allHrefs(NAV_GROUPS).some((href) => href.startsWith("/brands/")), false);
  });
});

describe("isNavActive", () => {
  it("ana sayfayı yalnızca tam eşleşmede aktif sayar", () => {
    assert.equal(isNavActive("/", "/"), true);
    assert.equal(isNavActive("/tasks", "/"), false);
  });

  it("bir bölümün alt rotasını aktif sayar", () => {
    assert.equal(isNavActive("/social/takvim", "/social"), true);
  });

  it("benzer ama alakasız yolu aktif saymaz", () => {
    assert.equal(isNavActive("/socialmedia", "/social"), false);
  });
});

describe("routeContextForPathname", () => {
  it("Panom analiz rotalarını global menüyü çoğaltmadan adlandırır", () => {
    assert.deepEqual(routeContextForPathname("/panom/katkim"), { section: "Panom", label: "Katkı analizi" });
    assert.deepEqual(routeContextForPathname("/panom/markalar"), { section: "Panom", label: "Marka analizi" });
    assert.equal(isNavActive("/panom/katkim", "/panom"), true);
  });

  it("profil, ayar ve güvenliği farklı sorumluluklar olarak adlandırır", () => {
    assert.deepEqual(routeContextForPathname("/team/p1"), { section: "Ekip", label: "Kişi profili" });
    assert.deepEqual(routeContextForPathname("/team/manage"), { section: "Ekip", label: "Hesap yönetimi" });
    assert.deepEqual(routeContextForPathname("/settings/profile"), { section: "Ayarlar", label: "Profil bilgileri" });
    assert.deepEqual(routeContextForPathname("/settings/security"), { section: "Ayarlar", label: "Güvenlik" });
  });

  it("marka etkinlik raporu rotasını marka çalışma alanından ayırır", () => {
    assert.deepEqual(routeContextForPathname("/brands/b1/reports"), { section: "Markalar", label: "Etkinlik raporları" });
  });
});
