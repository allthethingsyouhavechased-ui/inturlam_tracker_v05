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
    assert.match(views, /aria-label="Bana atanmış görev görünümü araçları"/);
    assert.match(views, /view === "liste"[\s\S]*?<TaskListColumnsControl/);
    assert.match(views, /visibleColumns=\{taskListColumns\}/);
    assert.match(views, /onVisibleColumnsChange=\{setTaskListColumns\}/);
    assert.match(views, /showColumnsControl=\{false\}/);
    assert.doesNotMatch(views, /toolbar=\{toggle\}/);
  });
});

describe("Pano görev kartı bilgi hiyerarşisi", () => {
  it("başlığı meta bilgilerden önce verir ve sabit yüksekliğe sıkıştırmaz", () => {
    const card = source("components/TaskGridCard.tsx");
    const title = card.indexOf("{task.title}");
    const contentTitle = card.indexOf("{task.content_title}");

    assert.ok(title >= 0 && contentTitle > title);
    assert.doesNotMatch(card, /h-\[210px\]/);
    assert.match(card, /aria-label="Görev zamanlaması"/);
    assert.match(card, /aria-label="Görev ayrıntıları"/);
  });
});
