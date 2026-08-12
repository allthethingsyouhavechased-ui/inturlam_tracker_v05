import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("masaüstü uygulama kabuğu", () => {
  it("sidebar'ı viewport'a sabitler ve akışta aynı genişlikte yer ayırır", () => {
    const frame = source("components/SidebarMobileFrame.tsx");
    const css = source("app/globals.css");

    assert.match(frame, /sidebar-spacer hidden shrink-0 md:block/);
    assert.doesNotMatch(frame, /md:sticky/);
    assert.match(css, /\.sidebar-panel,\s*\n\s*\.sidebar-spacer/);
    assert.match(css, /html\[data-sidebar="collapsed"\] \.sidebar-spacer/);
  });
});

describe("marka başlığı bilgi hiyerarşisi", () => {
  it("marka özeti, aylık hedef ve aktifliği soldan sağa sıralar", () => {
    const page = source("app/brands/[brandId]/page.tsx");
    const summaryStart = page.indexOf("summary={");
    const brandSummary = page.indexOf('data-brand-info="summary"', summaryStart);
    const targets = page.indexOf('data-brand-info="targets"', brandSummary);
    const activity = page.indexOf('data-brand-info="activity"', targets);

    assert.ok(summaryStart >= 0);
    assert.ok(brandSummary > summaryStart);
    assert.ok(targets > brandSummary);
    assert.ok(activity > targets);
    assert.match(page, /xl:grid-cols-\[1\.1fr_1fr_0\.85fr\]/);
    assert.doesNotMatch(page, /operasyon özeti/);
  });

  it("aylık teslim düğmesini kompakt hedef ızgarasının boş dördüncü hücresinde tutar", () => {
    const targets = source("components/BrandContentTargetsSection.tsx");
    assert.match(targets, /data-compact-target-grid/);
    assert.match(targets, /compact && completionControl/);
    assert.match(targets, /compact \? "✓ Tamamlandı" : "✓ Aylık içerikler tamamlandı"/);
  });
});

describe("sayfa içerik ekseni", () => {
  it("Ekip ve Ayarlar başlıklarını ortak sayfa kabuğunun sol çizgisinde tutar", () => {
    const team = source("app/team/page.tsx");
    const settings = source("app/settings/layout.tsx");

    assert.match(team, /<div className="w-full">/);
    assert.doesNotMatch(team, /team-page-wide/);
    assert.match(settings, /<div className="w-full">/);
    assert.match(settings, /className="grid max-w-5xl/);
    assert.doesNotMatch(settings, /mx-auto max-w-5xl/);
  });
});
