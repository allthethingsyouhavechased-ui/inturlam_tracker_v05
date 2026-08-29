import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { join } from "node:path";

// Bu dosya YALNIZCA mekanizma ve bilgi sırası doğruluyor. Izgara şablonu, sınıf
// string'i ve başlık metni doğrulayan assert'ler 2026-08-27'de kaldırıldı:
// davranışı değil kodun aynı kalmasını şart koşuyorlardı, yani her görsel
// değişiklik gerçek bir regresyona işaret etmeyen kırık üretiyordu.
// Yeni assert eklerken ölçüt: bu satır bir KULLANICI davranışını mı, yoksa bir
// tasarım tercihini mi kilitliyor? İkincisiyse buraya yazma.
function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("masaüstü uygulama kabuğu", () => {
  it("sidebar'ı viewport'a sabitler ve akışta aynı genişlikte yer ayırır", () => {
    const frame = source("components/SidebarMobileFrame.tsx");
    const css = source("app/globals.css");

    // Panel ile spacer'ın genişliği AYNI değişkenden gelmeli; ayrışırsa daraltma
    // sırasında içerik sidebar'ın altına kayar.
    assert.match(frame, /sidebar-spacer/);
    assert.match(css, /\.sidebar-panel,\s*\r?\n\s*\.sidebar-spacer/);
    assert.match(css, /html\[data-sidebar="collapsed"\] \.sidebar-spacer/);
  });
});

describe("marka başlığı bilgi hiyerarşisi", () => {
  it("başlık özetini sade tutup sorumluları ve hedefleri ilgili çalışma yüzeylerine taşır", () => {
    const page = source("app/brands/[brandId]/page.tsx");
    const summary = source("components/BrandWorkspaceSummary.tsx");
    const brandSummary = summary.indexOf('data-brand-info="summary"');
    const activity = summary.indexOf('data-brand-info="activity"', brandSummary);
    const shoots = summary.indexOf('data-brand-info="shoots"', activity);
    const pageHeader = page.indexOf("<PageHeader");
    const responsibility = page.indexOf('aria-label="Marka sorumluları"', pageHeader);
    const operations = page.indexOf("<BrandOperationsOverview", responsibility);
    const targets = page.indexOf("<BrandContentTargetsSection", operations);

    assert.match(page, /<BrandWorkspaceSummary/);
    assert.match(page, /<PageHeader[\s\S]*summary=\{workspaceSummary\}[\s\S]*actions=\{headerActions\}/);
    assert.equal(page.match(/\{workspaceSummary\}/g)?.length, 1);
    assert.ok(brandSummary >= 0);
    assert.ok(activity > brandSummary);
    assert.ok(shoots > activity);
    assert.doesNotMatch(summary, /data-brand-info="(?:responsibility|targets)"/);
    assert.ok(responsibility > pageHeader);
    assert.ok(operations > responsibility);
    assert.ok(targets > operations);
    assert.doesNotMatch(page, /brand\.key_finding|staleStats/);
  });

  it("kompakt hedefleri başlık solda, kontroller sağda tek satırda sunar", () => {
    const targets = source("components/BrandContentTargetsSection.tsx");
    assert.match(targets, /compact && completionControl/);
    assert.match(targets, /flex min-w-0 items-center justify-center gap-8/);
    assert.ok(targets.indexOf('compact \? "AYLIK HEDEF"') < targets.indexOf("data-compact-target-grid"));
    assert.match(targets, /flex-nowrap/);
    assert.match(targets, /grid shrink-0 gap-1 text-center text-\[9px\]/);
    assert.match(source("components/BrandOperationsOverview.tsx"), /xl:grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/);
    assert.match(source("app/brands/\[brandId\]/page.tsx"), /className="!mb-0"/);
  });
});
