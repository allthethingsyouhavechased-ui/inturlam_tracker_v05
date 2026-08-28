import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("INTracker ürün kimliği", () => {
  it("ürün adını tek bir wordmark bileşeninden üretir", () => {
    const wordmark = source("components/ProductWordmark.tsx");
    const sidebar = source("components/Sidebar.tsx");
    const guestShell = source("components/GuestShell.tsx");
    const whoami = source("app/whoami/page.tsx");

    assert.match(wordmark, />INT</);
    assert.match(wordmark, />racker</);
    assert.match(wordmark, /font-bold/);
    assert.match(wordmark, /font-normal/);
    assert.match(sidebar, /<ProductWordmark/);
    assert.match(guestShell, /<ProductWordmark/);
    assert.match(whoami, /<ProductWordmark/);
  });

  it("tarayıcı ve kurulum metadatasında INTracker adını kullanır", () => {
    assert.match(source("app/layout.tsx"), /title: "INTracker"/);
    assert.match(source("app/manifest.ts"), /name: "INTracker"/);
    assert.match(source("app/manifest.ts"), /short_name: "INTracker"/);
  });
});
