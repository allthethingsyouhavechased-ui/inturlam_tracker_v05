import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Panom teslim radari", () => {
  it("varsayilan olarak kapali baslar ve tercihi kisi bazinda saklar", () => {
    const radar = source("components/PersonalDeadlineRadar.tsx");

    assert.match(radar, /usePanelOpen\(`\$\{PANEL_KEY\}:\$\{personId\}`, false\)/);
    assert.match(radar, /if \(!open\)/);
    assert.match(radar, /Kişisel teslim radarını aç/);
    assert.match(radar, /lg:absolute lg:right-0 lg:top-8/);
    assert.match(source("app/panom/page.tsx"), /headerAction/);
  });
});

describe("On talep karari", () => {
  it("onaydan once atanacak kisiyi acikca sectirir", () => {
    const review = source("components/RequestReviewForm.tsx");

    assert.match(review, /Görev sahibi/);
    assert.match(review, /Onayla ve görevi ata/);
    assert.match(review, /name="assigneeId"/);
    assert.match(review, /Atanacak kişiyi seç/);
    assert.match(review, /<optgroup/);
    assert.match(review, /setDepartment\(person\.department as DepartmentId\)/);
  });
});

describe("Uygulama kabugu ve durum dili", () => {
  it("ana aramayi masaustunde viewport merkezine sabitler", () => {
    const header = source("components/Header.tsx");
    const css = source("app/globals.css");

    assert.match(header, /header-search-center/);
    assert.match(css, /\.header-search-center/);
    assert.match(css, /left: calc\(50% - var\(--sidebar-expanded\) \/ 2\)/);
    assert.match(css, /html\[data-sidebar="collapsed"\] \.header-search-center/);
  });

  it("beklemede ile devam ediyor renklerini notr ve gok mavisi olarak ayirir", () => {
    const constants = source("lib/constants.ts");

    assert.match(constants, /Beklemede:[\s\S]*?bg-zinc-/);
    assert.match(constants, /DevamEdiyor:[\s\S]*?bg-sky-/);
  });
});

describe("Sosyal ozet", () => {
  it("hesap sagligi, sayilar ve son taramayi tek dikey blokta toplar", () => {
    const layout = source("app/social/layout.tsx");
    const health = layout.indexOf("Hesap sağlığı");
    const counts = layout.indexOf("hesap kontrol edildi", health);
    const scan = layout.indexOf("Son tarama", counts);

    assert.ok(health >= 0);
    assert.ok(counts > health);
    assert.ok(scan > counts);
    assert.doesNotMatch(layout, /justify-between/);
    assert.match(layout, /actions=\{<SocialTabs \/>\}/);
  });
});

describe("Marka Instagram erişimi", () => {
  it("detayda yalnızca kullanıcı adını, listede hesap sütununu güvenli dış bağlantı yapar", () => {
    const detail = source("app/brands/[brandId]/page.tsx");
    const list = source("app/brands/page.tsx");

    assert.match(detail, /title=\{brand\.name\}/);
    assert.match(detail, /@\{instagramHandle\}/);
    assert.doesNotMatch(detail, /aria-label=\{`\$\{brand\.name\} Instagram hesabını aç`\}/);
    assert.match(detail, /target="_blank"/);
    assert.match(detail, /rel="noopener noreferrer"/);
    assert.match(list, /instagramProfileUrl/);
    assert.match(list, /aria-label=\{`\$\{brand\.name\} Instagram hesabını aç`\}/);
  });
});

describe("Ana sayfa sosyal uyarısı", () => {
  it("dört hesabı kartın orta alanında tek satıra yayar", () => {
    const card = source("components/SilentAccountsCard.tsx");

    assert.match(card, /lg:grid-cols-\[minmax\(14rem,0\.8fr\)_minmax\(0,1\.65fr\)_auto\]/);
    assert.match(card, /xl:grid-cols-4/);
    assert.doesNotMatch(card, /sm:max-w-\[46%\]/);
  });
});

describe("Rapor yoğunluğu", () => {
  it("teslim kartını diğer kartın yüksekliğine zorlamaz ve metrik dilini eşler", () => {
    const report = source("components/ReportsClient.tsx");
    const visuals = source("components/reports/ReportVisuals.tsx");

    assert.match(report, /Süre ve teslim analizi" className="grid items-start/);
    assert.match(visuals, /sm:grid-cols-5/);
    assert.match(visuals, /text-\[10px\] font-semibold uppercase tracking-wide/);
  });
});

describe("Marka düzenleme paneli", () => {
  it("formu başlık akışından çıkarıp erişilebilir bir modalda açar", () => {
    const form = source("components/EditBrandForm.tsx");

    assert.match(form, /createPortal/);
    assert.match(form, /fixed inset-0 z-50/);
    assert.match(form, /role="dialog"/);
    assert.match(form, /aria-modal="true"/);
    assert.match(form, /e\.key === "Escape"/);
    assert.match(form, /aria-label="Pencereyi kapat"/);
  });
});
