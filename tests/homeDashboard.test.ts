import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

// 2026-08-27: başlık metni (`KİŞİSEL MARKA GÖRÜNÜMÜ` gibi eyebrow kopyaları) ve
// bileşen-içi render detayı (`<ProgressTrack progress={...}`) doğrulayan
// assert'ler kaldırıldı. Kalan assert'ler sayfanın hangi VERİYİ okuduğunu ve
// kişisel odağı hangi kuralla süzdüğünü koruyor — bunlar bozulursa pano yanlış
// sayı gösterir, yalnızca farklı görünmez.
const source = fs.readFileSync(path.join(process.cwd(), "app", "page.tsx"), "utf8");

describe("Bugün sayfası bilgi akışı", () => {
  it("üst operasyon göstergelerini ve sosyal uyarı şeridini koruyor", () => {
    assert.match(source, /aria-label="Operasyon göstergeleri"/);
    assert.match(source, /<Metric href="\/brands"/);
    assert.match(source, /<SilentAccountsCard/);
  });

  it("kişisel ve portföy ilerlemesini doğru repository çağrılarından besliyor", () => {
    assert.match(source, /listPersonBrandAssignments/);
    assert.match(source, /listBrandMonthlyProgress/);
    assert.match(source, /getPortfolioMonthlyProgress/);
    assert.match(source, /listMonthlyTaskStatusCounts/);
    assert.match(source, /getPersonPointTargetProgress/);
    assert.match(source, /<HomeBrandProgress/);
    assert.doesNotMatch(source, /TaskPanel|ActivityPanel|listRecentActivity/);
  });

  it("kişisel odağı teslim, revize ve inceleme kurallarıyla süzüyor", () => {
    assert.match(source, /<HomeFocusPanel/);
    assert.match(source, /getPersonPointTargetProgress/);
    assert.match(source, /task\.status === "Beklemede" \|\| task\.status === "DevamEdiyor"/);
    assert.match(source, /task\.active_revision_id !== null && task\.assignee_id === me\.id/);
    assert.match(source, /task\.status === "Incelemede" && task\.assignee_id === me\.id/);
  });
});
