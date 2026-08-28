import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

// 2026-08-27 ayıklaması: ızgara şablonu (`xl:grid-cols-4`,
// `lg:grid-cols-[minmax(14rem,0.8fr)_...]`), tipografi sınıfı
// (`text-[10px] font-semibold uppercase tracking-wide`) ve palet
// (`Beklemede: bg-zinc-`) doğrulayan assert'ler kaldırıldı. Bunlar davranış
// değil tasarım tercihi kilitliyordu; tasarım revizyonunun önündeki asıl
// sürtünme buydu. Kalanlar: erişilebilirlik sözleşmeleri, bilgi sırası,
// bileşen kablolaması ve dış bağlantı güvenliği.
function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Panom teslim radari", () => {
  it("tetikleyiciyi normal akıştaki varsayılan açık panelden ayırır", () => {
    const radar = source("components/PersonalDeadlineRadar.tsx");
    const panom = source("app/panom/page.tsx");
    const views = source("components/PanomViews.tsx");

    assert.match(radar, /usePanelOpen\(`\$\{PANEL_KEY\}:\$\{personId\}`, true\)/);
    assert.match(radar, /export function PersonalDeadlineRadarTrigger/);
    assert.match(radar, /export function PersonalDeadlineRadarPanel/);
    assert.match(panom, /aria-label="Kişisel pano araçları"/);
    assert.match(panom, /<PersonalDeadlineRadarTrigger/);
    assert.match(panom, /href="\/panom\/markalar"/);
    assert.match(panom, /href="\/panom\/katkim"/);
    assert.doesNotMatch(panom, /PanomInsightStrip/);
    assert.match(panom, /<PersonalDeadlineRadarPanel/);
    assert.ok(panom.indexOf("<PersonalDeadlineRadarPanel") < panom.indexOf("<PanomViews"));
    assert.doesNotMatch(source("app/globals.css"), /\.panom-dock-panel/);
    assert.match(source("app/panom/markalar/page.tsx"), /combineMonthlyProgress/);
    assert.doesNotMatch(views, /otherTasks|Ekipte gecikmiş \/ bu hafta teslim/);
  });
});

describe("İkincil operasyon panelleri", () => {
  it("tarih bekleyenleri Görevler başlığındaki açılır düğmeye taşır", () => {
    const tasks = source("app/tasks/page.tsx");
    const queue = source("components/TaskPlanningQueue.tsx");

    assert.match(tasks, /actions=\{[\s\S]*?<TaskPlanningQueue/);
    assert.match(queue, /Tarih bekleyenler/);
    assert.match(queue, /Planlama kuyruğu/);
  });

  it("ekip aylık puanını aktif iş akışının hemen altındaki kapalı panele alır", () => {
    const reports = source("components/ReportsClient.tsx");
    const workflowPanel = reports.indexOf('panelKey="workflow"');
    const scorePanel = reports.indexOf('panelKey="team-monthly-score"');
    const departmentSection = reports.indexOf('id="departman-raporu"');

    assert.ok(workflowPanel >= 0 && scorePanel > workflowPanel && departmentSection > scorePanel);
    assert.match(reports, /defaultOpen=\{false\}/);
    assert.match(source("app/reports/page.tsx"), /teamMonthlyProgress=\{teamMonthlyProgress\}/);
  });
});

describe("On talep karari", () => {
  it("onaydan once atanacak kisiyi acikca sectirir", () => {
    const review = source("components/RequestReviewForm.tsx");

    assert.match(review, /Onayla ve görevi ata/);
    assert.match(review, /name="assigneeId"/);
    assert.match(review, /<optgroup/);
    assert.match(review, /setDepartment\(person\.department as DepartmentId\)/);
  });
});

describe("Uygulama kabugu", () => {
  it("ana aramayi masaustunde viewport merkezine sabitler", () => {
    const header = source("components/Header.tsx");
    const css = source("app/globals.css");

    // Sidebar açılıp kapandığında arama kutusunun gözle kaymaması bu iki kuralın
    // birlikte durmasına bağlı — mekanizma, stil tercihi değil.
    assert.match(header, /header-search-center/);
    assert.match(css, /\.header-search-center/);
    assert.match(css, /left: calc\(50% - var\(--sidebar-expanded\) \/ 2\)/);
    assert.match(css, /html\[data-sidebar="collapsed"\] \.header-search-center/);
  });
});

describe("Sosyal ozet", () => {
  it("hesap sagligi, sayilar ve son taramayi bu sirada verir", () => {
    const layout = source("app/social/layout.tsx");
    const health = layout.indexOf("Hesap sağlığı");
    const counts = layout.indexOf("hesap kontrol edildi", health);
    const scan = layout.indexOf("Son tarama", counts);

    assert.ok(health >= 0);
    assert.ok(counts > health);
    assert.ok(scan > counts);
    assert.match(layout, /actions=\{<SocialTabs \/>\}/);
  });
});

describe("Marka Instagram erişimi", () => {
  it("detayda yalnızca kullanıcı adını, listede hesap sütununu güvenli dış bağlantı yapar", () => {
    const detail = source("app/brands/[brandId]/page.tsx");
    const list = source("components/BrandsPortfolioTable.tsx");
    const listPage = source("app/brands/page.tsx");

    assert.match(detail, /@\{instagramHandle\}/);
    assert.match(detail, /target="_blank"/);
    assert.match(detail, /rel="noopener noreferrer"/);
    assert.match(listPage, /instagramProfileUrl/);
    assert.match(list, /aria-label=\{`\$\{row\.name\} Instagram hesabını aç`\}/);
  });
});

describe("Marka düzenleme paneli", () => {
  it("formu başlık akışından çıkarıp erişilebilir bir modalda açar", () => {
    const form = source("components/EditBrandForm.tsx");

    assert.match(form, /createPortal/);
    assert.match(form, /role="dialog"/);
    assert.match(form, /aria-modal="true"/);
    assert.match(form, /e\.key === "Escape"/);
    assert.match(form, /aria-label="Pencereyi kapat"/);
  });
});
