import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Görev detay sekmeleri", () => {
  it("bağlantı listesi yerine yalnız seçili paneli gösteren erişilebilir sekmeler kullanır", () => {
    const page = source("app/tasks/[taskId]/page.tsx");
    const tabs = source("components/TaskDetailTabs.tsx");

    assert.match(page, /<TaskDetailTabs/);
    assert.match(page, /details=\{/);
    assert.match(page, /workflow=\{/);
    assert.match(page, /delivery=\{/);
    assert.match(page, /revision=\{/);
    assert.match(page, /comments=\{/);
    assert.match(page, /activity=\{/);
    assert.doesNotMatch(page, /SectionJumpNav|JUMP_SECTIONS/);

    assert.match(tabs, /role="tablist"/);
    assert.match(tabs, /role="tab"/);
    assert.match(tabs, /aria-selected=\{selected\}/);
    assert.match(tabs, /role="tabpanel"/);
    assert.match(tabs, /\{panels\[activeTab\]\}/);
    assert.match(tabs, /window\.history\.replaceState/);
    assert.match(tabs, /ArrowRight/);
    assert.match(tabs, /ArrowLeft/);
    assert.match(tabs, /Home/);
    assert.match(tabs, /End/);
  });
});
