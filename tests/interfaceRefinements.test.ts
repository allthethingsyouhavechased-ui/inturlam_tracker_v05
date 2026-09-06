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

    assert.match(radar, /usePanelOpen\(`\$\{PANEL_KEY\}:\$\{personId\}`, false\)/);
    assert.match(radar, /createPortal/);
    assert.match(radar, /role="dialog"/);
    assert.match(radar, /aria-modal="true"/);
    assert.match(radar, /items-start justify-center[\s\S]*max-w-6xl/);
    assert.doesNotMatch(radar, /inset-y-0 right-0/);
    assert.match(radar, /event\.key === "Escape"/);
    assert.match(radar, /document\.body\.style\.overflow = "hidden"/);
    assert.match(radar, /<DndContext[\s\S]*collisionDetection=\{dayCollisionDetection\}[\s\S]*onDragEnd=\{handleDragEnd\}/);
    assert.match(radar, /useDraggable\(\{ id: task\.id \}\)/);
    assert.match(radar, /useDroppable\(\{ id: `\$\{DROP_PREFIX\}\$\{date\}`/);
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
  it("görev sonucunu ayrı satır açmadan görünüm seçicinin solunda gösterir", () => {
    const explorer = source("components/TaskExplorer.tsx");
    const result = explorer.indexOf("{filtered.length}");
    const viewToggle = explorer.indexOf("<WorkspaceViewToggle", result);
    const board = explorer.indexOf("filtered.length === 0", viewToggle);

    assert.ok(result >= 0 && viewToggle > result && board > viewToggle);
    assert.equal(explorer.match(/\{filtered\.length\}/g)?.length, 1);
    assert.match(explorer, /ml-auto whitespace-nowrap text-xs text-muted/);
  });

  it("tarih bekleyenleri Görevler başlığındaki açılır düğmeye taşır", () => {
    const tasks = source("app/tasks/page.tsx");
    const queue = source("components/TaskPlanningQueue.tsx");

    assert.match(tasks, /actions=\{[\s\S]*?<TaskPlanningQueue/);
    assert.match(queue, /Tarih bekleyenler/);
    assert.match(queue, /Planlama kuyruğu/);
  });

  it("aktif iş akışı ve ekip aylık puanını aynı sekmeli analiz yüzeyinde tutar", () => {
    const reports = source("components/ReportsClient.tsx");
    const workflowPanel = reports.indexOf('["workflow", `Aktif akış');
    const scorePanel = reports.indexOf('["score", "Aylık puan"]');
    const departmentSection = reports.indexOf('id="departman-raporu"');

    assert.ok(workflowPanel >= 0 && scorePanel > workflowPanel && departmentSection > scorePanel);
    assert.match(reports, /role="tablist" aria-label="Operasyon analizi"/);
    assert.match(reports, /analysisView === "score"/);
    assert.match(source("app/reports/page.tsx"), /teamMonthlyProgress=\{teamMonthlyProgress\}/);
  });

  it("raporları açılır yönetim, analiz ve detay yüzeylerinde doğru sırada toplar", () => {
    const reports = source("components/ReportsClient.tsx");
    const panels = source("components/reports/CollapsiblePanel.tsx");
    const management = reports.indexOf('panelKey="reports-management"');
    const analysis = reports.indexOf('panelKey="reports-analysis"');
    const details = reports.indexOf('panelKey="reports-details"');
    const flow = reports.indexOf('panelKey="reports-flow-health"');

    assert.match(reports, /<RangeFilterBar[\s\S]*<ExcelDownloadLink[\s\S]*<PrintButton/);
    assert.ok(management >= 0 && analysis > management && details > analysis && flow > details);
    assert.match(reports, /titleId="report-summary-title"/);
    assert.match(reports, /titleId="flow-health-title"[\s\S]*<TrendChart report=\{trend\} embedded \/>[\s\S]*<CycleTimePanel report=\{cycleTime\} embedded \/>[\s\S]*<DueHealthPanel rows=\{dueHealth\} embedded \/>/);
    assert.match(reports, /role="tablist" aria-label="Rapor detayları"/);
    assert.match(reports, /hidden=\{detailView !== "department"\}/);
    assert.match(reports, /hidden=\{detailView !== "people"\}/);
    assert.match(reports, /hidden=\{detailView !== "brands"\}/);
    assert.match(panels, /aria-expanded=\{open\}/);
    assert.match(panels, /onClick=\{toggle\}/);
    assert.match(panels, /actions && open/);
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
  it("ana aramayi hedef ve aksiyonlarla ayni esnek satirda tutar", () => {
    const header = source("components/Header.tsx");
    // G21 hedef göstergesi eklendiğinde mutlak merkezleme aramayı aksiyonlarla
    // üst üste bindiriyordu. Daralabilen normal akış bunu önler.
    assert.doesNotMatch(header, /header-search-center/);
    assert.match(header, /flex min-w-0 flex-1[^\n]*[\s\S]*?<GlobalSearch/);
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

describe("Görev durum renkleri", () => {
  it("Bugün ve marka operasyon özetlerini kanban sütunlarıyla aynı paletten besler", () => {
    const constants = source("lib/constants.ts");
    const homeProgress = source("components/HomeBrandProgress.tsx");
    const brandOperations = source("components/BrandOperationsOverview.tsx");

    // Renk DEĞERİNİ değil KURALI doğruluyoruz (bkz. CLAUDE.md test felsefesi):
    // durum metninin tonu, o durumun kanban sütunundaki noktasıyla aynı olmalı.
    // Palet değişirse test kırılmaz; iki liste ayrışırsa kırılır.
    const paletteOf = (name: string): Record<string, string> => {
      const block = constants.match(new RegExp(`${name}: Record<TaskStatus, string> = \\{([^}]*)\\}`))?.[1];
      assert.ok(block, `${name} bulunamadı`);
      return Object.fromEntries(
        [...block.matchAll(/(\w+): "([^"]+)"/g)].map(([, status, value]) => [status, value]),
      );
    };
    const dots = paletteOf("TASK_STATUS_DOT");
    const texts = paletteOf("TASK_STATUS_TEXT");
    assert.deepEqual(Object.keys(texts), Object.keys(dots));
    for (const [status, dot] of Object.entries(dots)) {
      assert.equal(texts[status], dot.replace(/(?:^|\s)bg-/g, "text-"), `${status} tonu sütunla aynı değil`);
    }
    assert.match(homeProgress, /TASK_STATUS_TEXT\[status\]/);
    assert.match(brandOperations, /TASK_STATUS_TEXT\[status\]/);
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
