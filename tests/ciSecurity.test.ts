import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("CI güvenlik sınırları", () => {
  it("üçüncü taraf action'ları immutable commit SHA'larına sabitler", () => {
    const workflow = source(".github/workflows/ci.yml");
    const uses = [...workflow.matchAll(/uses:\s+(actions\/[\w-]+)@([^\s#]+)/g)];
    assert.ok(uses.length >= 2);
    for (const [, action, ref] of uses) {
      assert.match(ref, /^[a-f0-9]{40}$/, `${action} değiştirilemez SHA ile sabitlenmeli`);
    }
  });

  it("GITHUB_TOKEN yetkisini salt okumayla sınırlar", () => {
    const workflow = source(".github/workflows/ci.yml");
    assert.match(workflow, /permissions:\s*\n\s+contents:\s+read/);
  });

  it("workflow değişikliklerine açık bir kod sahibi atar", () => {
    const codeowners = source(".github/CODEOWNERS");
    assert.match(codeowners, /^\/\.github\/workflows\/\s+@\S+/m);
  });
});
