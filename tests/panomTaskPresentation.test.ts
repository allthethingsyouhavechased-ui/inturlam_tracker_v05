import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Panom görev görünümü araçları", () => {
  it("görünüm ve liste sütunlarını bölüm başlığında birlikte yönetir", () => {
    const views = source("components/PanomViews.tsx");

    assert.match(views, /TaskListColumnsControl/);
    assert.match(views, /DEFAULT_TASK_LIST_COLUMNS/);
    assert.match(views, /aria-label="Kişisel görev görünümü araçları"/);
    assert.match(views, /aria-label="Kişisel görevleri sırala"/);
    assert.match(views, /sortKey=\{sortKey\}/);
    assert.match(views, /view === "liste"[\s\S]*?<TaskListColumnsControl/);
    assert.match(views, /visibleColumns=\{taskListColumns\}/);
    assert.match(views, /onVisibleColumnsChange=\{setTaskListColumns\}/);
    assert.match(views, /showColumnsControl=\{false\}/);
    assert.match(views, /<WorkspaceViewToggle view=\{view\} onChange=\{changeView\}/);
    assert.doesNotMatch(views, /toolbar=\{/);
    assert.doesNotMatch(views, /Bana atanmış görevler/);
  });
});

describe("Pano görev kartı bilgi hiyerarşisi", () => {
  it("başlığı meta bilgilerden önce verir ve sabit yüksekliğe sıkıştırmaz", () => {
    const card = source("components/TaskGridCard.tsx");
    const title = card.indexOf("{task.title}");
    const contentTitle = card.indexOf("{task.content_title}");

    assert.ok(title >= 0 && contentTitle > title);
    assert.doesNotMatch(card, /h-\[210px\]/);
    assert.match(card, /aria-label="Görev zamanlaması ve sorumlusu"/);
    assert.match(card, /aria-label="Görev ayrıntıları"/);
    assert.match(card, /className="relative flex min-w-0 flex-col overflow-hidden rounded-xl[^"]* p-3/);
    assert.match(card, /absolute inset-y-0 left-0 w-\[3px\]/);
    assert.doesNotMatch(card, /className="brand-stripe/);
    assert.match(card, /grid-cols-\[minmax\(0,1fr\)_auto\][^"]*gap-x-2 gap-y-1/);
  });
});
