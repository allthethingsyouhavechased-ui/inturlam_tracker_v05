import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const tasksPage = fs.readFileSync(path.join(process.cwd(), "app", "tasks", "page.tsx"), "utf8");
const archivePage = fs.readFileSync(path.join(process.cwd(), "app", "tasks", "archive", "page.tsx"), "utf8");
const explorer = fs.readFileSync(path.join(process.cwd(), "components", "TaskArchiveExplorer.tsx"), "utf8");
const activeExplorer = fs.readFileSync(path.join(process.cwd(), "components", "TaskExplorer.tsx"), "utf8");

describe("ayrı görev arşivi", () => {
  it("aktif görev sayfasına arşiv kayıtlarını indirmez ve ayrı rotaya bağlanır", () => {
    assert.match(tasksPage, /listTaskPage\(me.id/);
    assert.doesNotMatch(tasksPage, /listAllTasks/);
    assert.match(fs.readFileSync(path.join(process.cwd(), "lib/repositories/taskListing.ts"), "utf8"), /t.archived_at IS NULL/);
    assert.match(activeExplorer, /href="\/tasks\/archive"/);
  });

  it("arşivi pano sütunları yerine aranabilir ve aylık gruplu kayıt görünümünde sunar", () => {
    assert.match(archivePage, /TaskArchiveExplorer/);
    assert.doesNotMatch(archivePage, /TaskBoard/);
    assert.match(explorer, /Arşiv ayı/);
    assert.match(explorer, /Zorluk/);
    assert.match(explorer, /Revize/);
    assert.match(explorer, /archiveMonth/);
    assert.match(explorer, /ArchiveTaskButton/);
    assert.match(
      fs.readFileSync(path.join(process.cwd(), "components", "ArchiveTaskButton.tsx"), "utf8"),
      /restoreArchivedTaskAction/,
    );
  });
});
