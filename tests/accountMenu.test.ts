import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const source = fs.readFileSync(
  path.join(process.cwd(), "components", "AccountMenu.tsx"),
  "utf8",
);

describe("profil menüsü kapanma davranışı", () => {
  it("dışarı tıklamayı ve Escape tuşunu dinliyor", () => {
    assert.match(source, /document\.addEventListener\("pointerdown"/);
    assert.match(source, /!container\.contains\(event\.target as Node\)/);
    assert.match(source, /event\.key === "Escape"/);
  });

  it("açık durumu erişilebilir tetikleyiciye yansıtıyor", () => {
    assert.match(source, /aria-expanded=\{open\}/);
    assert.match(source, /aria-controls=\{panelId\}/);
  });
});
