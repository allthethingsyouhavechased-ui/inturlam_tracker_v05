import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const source = fs.readFileSync(
  path.join(process.cwd(), "components", "Header.tsx"),
  "utf8",
);

describe("üst çubuk veri sınırı", () => {
  it("oturum yokken operasyon listelerini sorgulamaz ve görev oluşturucuyu çizmez", () => {
    assert.match(source, /const brands = person \? listBrands\(\) : \[\];/);
    assert.match(source, /const contents = person \? listAllContentSummaries\(\) : \[\];/);
    assert.match(source, /const people = person \? listActivePeople\(\) : \[\];/);
    assert.match(source, /\{person && \(\s*<QuickAddModal/);
  });
});
