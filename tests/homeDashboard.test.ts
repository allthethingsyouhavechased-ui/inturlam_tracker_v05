import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const source = fs.readFileSync(path.join(process.cwd(), "app", "page.tsx"), "utf8");

describe("Bugün sayfası bilgi akışı", () => {
  it("boş kalan sol sütunda son ajans hareketlerini gösteriyor", () => {
    assert.match(source, /listRecentActivity\(3\)/);
    assert.match(source, /title="Ajans akışı"/);
    assert.match(source, /<ActivityPanel[\s\S]*entries=\{recentActivity\}/);
    assert.match(source, /<ActivityFeed entries=\{entries\}/);
  });

  it("ajans akışını gecikmiş panelle aynı sütunda tutuyor", () => {
    assert.match(source, /className="space-y-5"[\s\S]*id="gecikmis"[\s\S]*title="Ajans akışı"/);
  });
});
