import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const source = fs.readFileSync(path.join(process.cwd(), "app", "page.tsx"), "utf8");
const progressSource = fs.readFileSync(path.join(process.cwd(), "components", "HomeBrandProgress.tsx"), "utf8");
const focusSource = fs.readFileSync(path.join(process.cwd(), "components", "HomeFocusPanel.tsx"), "utf8");

describe("Bugün sayfası bilgi akışı", () => {
  it("üst operasyon göstergelerini ve sosyal uyarı şeridini koruyor", () => {
    assert.match(source, /aria-label="Operasyon göstergeleri"/);
    assert.match(source, /<Metric href="\/brands"/);
    assert.match(source, /<SilentAccountsCard/);
  });

  it("alt alanı kişisel ve portföy marka ilerlemesine ayırıyor", () => {
    assert.match(source, /listPersonBrandAssignments/);
    assert.match(source, /listBrandMonthlyProgress/);
    assert.match(source, /getPortfolioMonthlyProgress/);
    assert.match(source, /listMonthlyTaskStatusCounts/);
    assert.match(source, /combineMonthlyProgress/);
    assert.match(source, /<HomeBrandProgress/);
    assert.match(progressSource, /KİŞİSEL MARKA GÖRÜNÜMÜ/);
    assert.match(progressSource, /PORTFÖY AYLIK İLERLEME/);
    assert.match(progressSource, /AYLIK ÜRETİM AKIŞI/);
    assert.match(progressSource, /Atanmış markalar toplamı/);
    assert.doesNotMatch(source, /TaskPanel|ActivityPanel|listRecentActivity/);
  });

  it("kişisel teslim, revize ve inceleme odağını aylık kişisel/genel analizle birleştiriyor", () => {
    assert.match(source, /<HomeFocusPanel/);
    assert.match(source, /getPersonMonthlyProgress/);
    assert.match(focusSource, /Yakın teslimlerim/);
    assert.match(focusSource, /Aktif revizelerim/);
    assert.match(focusSource, /İncelemedeki işlerim/);
    assert.match(source, /task\.status === "Beklemede" \|\| task\.status === "DevamEdiyor"/);
    assert.match(source, /task\.active_revision_id !== null && task\.assignee_id === me\.id/);
    assert.match(source, /task\.status === "Incelemede" && task\.assignee_id === me\.id/);
    assert.ok(source.indexOf("<HomeBrandProgress") < source.indexOf("<HomeFocusPanel"));
    assert.match(source, /personalFocus=\{\([\s\S]*<HomeFocusPanel[\s\S]*compact/);
    assert.match(progressSource, /\{personalFocus\}/);
    assert.match(progressSource, /BENİM AYLIK İLERLEMEM/);
    assert.match(progressSource, /ÜZERİMDEKİ MARKALAR/);
    assert.match(progressSource, /PORTFÖY İLERLEMESİ/);
    assert.match(progressSource, /<ProgressTrack progress=\{personalProgress\}/);
    assert.match(progressSource, /<ProgressTrack progress=\{assignedBrandsProgress\}/);
    assert.match(progressSource, /<ProgressTrack progress=\{portfolioProgress\}/);
  });
});
