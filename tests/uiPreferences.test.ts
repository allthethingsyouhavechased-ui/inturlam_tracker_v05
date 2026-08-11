import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PANOM_VIEW_PREFERENCE,
  TASKS_VIEW_PREFERENCE,
  parseWorkspaceView,
} from "@/lib/uiPreferences";

describe("arayüz görünüm tercihleri", () => {
  it("yalnızca desteklenen pano ve liste değerlerini kabul ediyor", () => {
    assert.equal(parseWorkspaceView("pano"), "pano");
    assert.equal(parseWorkspaceView("liste"), "liste");
    assert.equal(parseWorkspaceView("grid"), "pano");
    assert.equal(parseWorkspaceView(undefined, "liste"), "liste");
  });

  it("Panom ve Görevler tercihlerini birbirinden ayrı tutuyor", () => {
    assert.notEqual(PANOM_VIEW_PREFERENCE.cookie, TASKS_VIEW_PREFERENCE.cookie);
    assert.notEqual(PANOM_VIEW_PREFERENCE.storage, TASKS_VIEW_PREFERENCE.storage);
  });
});
