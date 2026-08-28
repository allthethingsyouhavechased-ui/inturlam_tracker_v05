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
  it("marka özeti, aylık hedef, aktiflik ve hızlı işlemleri bu sırayla verir", () => {
    const page = source("app/brands/[brandId]/page.tsx");
    const summary = source("components/BrandWorkspaceSummary.tsx");
    const brandSummary = summary.indexOf('data-brand-info="summary"');
    const targets = summary.indexOf('data-brand-info="targets"', brandSummary);
    const activity = summary.indexOf('data-brand-info="activity"', targets);
    const actions = summary.indexOf('data-brand-info="actions"', activity);

    assert.match(page, /<BrandWorkspaceSummary/);
    assert.match(page, /<BrandWorkspaceSummary\s+embedded/);
    assert.match(page, /<PageHeader[\s\S]*summary=\{workspaceSummary\}/);
    assert.ok(brandSummary >= 0);
    assert.ok(targets > brandSummary);
    assert.ok(activity > targets);
    assert.ok(actions > activity);
  });

  it("kompakt hedef ızgarasında tamamlama kontrolünü ayrı satır açmadan sunar", () => {
    assert.match(source("components/BrandContentTargetsSection.tsx"), /compact && completionControl/);
  });
});
