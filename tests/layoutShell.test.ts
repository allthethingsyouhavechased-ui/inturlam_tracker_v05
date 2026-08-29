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
    // Şerit dört bilgiyi tek satırda taşır ve başlığın ALTINDA durur: özet →
    // aktiflik → sorumlular → çekim hakkı. Sonra operasyon kartı, en sonda
    // hedefler. Kilitlenen şey bilgi sırası, kutuların stili değil.
    const brandSummary = summary.indexOf('data-brand-info="summary"');
    const activity = summary.indexOf('data-brand-info="activity"', brandSummary);
    const responsibles = summary.indexOf('data-brand-info="responsibles"', activity);
    const shoots = summary.indexOf('data-brand-info="shoots"', responsibles);
    const pageHeader = page.indexOf("<PageHeader");
    const summaryStrip = page.indexOf("{workspaceSummary}", pageHeader);
    const responsibility = page.indexOf('aria-label="Marka sorumluları"');
    const operations = page.indexOf("<BrandOperationsOverview", summaryStrip);
    const targets = page.indexOf("<BrandContentTargetsSection", operations);

    assert.match(page, /<BrandWorkspaceSummary/);
    assert.match(page, /<PageHeader[\s\S]*actions=\{headerActions\}/);
    assert.equal(page.match(/\{workspaceSummary\}/g)?.length, 1);
    assert.ok(brandSummary >= 0);
    assert.ok(activity > brandSummary);
    assert.ok(responsibles > activity);
    assert.ok(shoots > responsibles);
    assert.doesNotMatch(summary, /data-brand-info="targets"/);
    assert.ok(responsibility >= 0);
    assert.ok(summaryStrip > pageHeader);
    assert.ok(operations > summaryStrip);
    assert.ok(targets > operations);
    assert.doesNotMatch(page, /brand\.key_finding|staleStats/);
  });

  it("kompakt hedefleri başlıksız, etiket-sayaç çiftleri hâlinde tek satırda sunar", () => {
    const targets = source("components/BrandContentTargetsSection.tsx");
    assert.match(targets, /compact && completionControl/);
    // Sayaçlar tek bir kontrol grubu gibi bitişik durur — şeridi kaplayıp
    // birbirinden kopmazlar.
    assert.match(targets, /compact \? "flex min-w-0 items-center gap-x-4/);
    assert.doesNotMatch(targets, /compact \? "flex min-w-0 flex-1/);
    // Ayrı bir başlık metni YOK — etiket kendi sayacının solunda. (Regex
    // tırnakları da eşliyor: aynı ifade kod yorumunda geçebilir.)
    assert.doesNotMatch(targets, /"AYLIK HEDEF"/);
    assert.match(targets, /compact \? "flex shrink-0 items-center gap-2 text-\[9px\]/);
    assert.match(source("components/BrandOperationsOverview.tsx"), /flex flex-wrap items-end justify-between/);
  });
});
