import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

function actionBody(file: string, name: string): string {
  const start = file.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} bulunamadı`);
  const next = file.indexOf("\nexport async function ", start + 1);
  return file.slice(start, next === -1 ? file.length : next);
}

describe("Server Action mutasyon bütünlüğü", () => {
  it("tekil mutasyonlar var olmayan hedefe sahte aktivite yazmaz", () => {
    const cases: Array<[string, string, string]> = [
      ["lib/actions/tasks.ts", "setTaskPriorityAction", "if (!task)"],
      ["lib/actions/tasks.ts", "setTaskAssigneeAction", "if (!task)"],
      ["lib/actions/tasks.ts", "updateTaskDetailsAction", "if (!task)"],
      ["lib/actions/tasks.ts", "deleteTaskAction", "if (!task)"],
      ["lib/actions/content.ts", "setContentStatusAction", "if (!content)"],
      ["lib/actions/content.ts", "updateContentItemAction", "if (!before)"],
      ["lib/actions/content.ts", "archiveContentItemAction", "if (!content)"],
      ["lib/actions/content.ts", "unarchiveContentItemAction", "if (!content)"],
      ["lib/actions/content.ts", "deleteContentItemAction", "if (!content)"],
      ["lib/actions/brands.ts", "archiveBrandAction", "if (!brand)"],
      ["lib/actions/brands.ts", "unarchiveBrandAction", "if (!brand)"],
      ["lib/actions/brands.ts", "deleteBrandAction", "if (!brand)"],
    ];
    for (const [path, action, guard] of cases) {
      assert.ok(actionBody(source(path), action).includes(guard), `${action} hedefi doğrulamalı`);
    }
  });

  it("toplu aktivite özetlerinde gerçek değişiklik sayısını kullanır", () => {
    const tasks = source("lib/actions/tasks.ts");
    for (const action of [
      "bulkSetTaskPriorityAction",
      "bulkSetTaskAssigneeAction",
      "bulkDeleteTasksAction",
    ]) {
      const body = actionBody(tasks, action);
      assert.match(body, /const changedCount =/);
      assert.match(body, /if \(changedCount > 0\)/);
      assert.doesNotMatch(body, /\$\{clean\.length\}/);
    }
  });

  it("hesap pasifleştirme korunan hedefi denetler ve oturumları iptal eder", () => {
    const people = actionBody(source("lib/actions/people.ts"), "deactivatePersonAction");
    assert.match(people, /assertCanDeactivatePerson\(person\.id\)/);
    assert.match(people, /deleteAuthSessionsForPerson\(person\.id\)/);
    assert.ok(
      people.indexOf("assertCanDeactivatePerson") < people.indexOf("setPersonActive"),
      "koruma, hesap pasifleştirilmeden önce çalışmalı",
    );
  });
});
