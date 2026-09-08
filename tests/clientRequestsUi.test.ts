import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

function source(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Talepler sayfası oluşturma akışı", () => {
  it("kalıcı form yerine üst düğmeyle açılan erişilebilir modal kullanır", () => {
    const page = source("app/requests/page.tsx");
    const dialog = source("components/ClientRequestCreateDialog.tsx");

    assert.match(page, /<ClientRequestCreateDialog brands=\{brands\} \/>/);
    assert.match(dialog, /aria-haspopup="dialog"/);
    assert.match(dialog, /role="dialog"/);
    assert.match(dialog, /aria-modal="true"/);
    assert.match(dialog, /createClientRequestAction/);
  });

  it("talep alanlarını, görsel eklemeyi ve durumdan liste filtrelemeyi korur", () => {
    const page = source("app/requests/page.tsx");
    const dialog = source("components/ClientRequestCreateDialog.tsx");

    for (const name of ["brandId", "title", "description", "department", "contentType", "dueDate", "requestedByName", "source", "referenceUrl"]) {
      assert.match(dialog, new RegExp(`name=["']${name}["']`), `${name} alanı eksik`);
    }
    assert.match(dialog, /<RequestImagePicker \/>/);
    assert.match(page, /selectedStatus === status/);
    assert.match(page, /allRequests\.filter\(\(request\) => request\.status === selectedStatus\)/);
  });

  it("talep kartının tamamını detay bağlantısı yapar ve görev bağlantısını ayrı tutar", () => {
    const page = source("app/requests/page.tsx");

    assert.match(page, /aria-label=\{`\$\{request\.title\} talebini aç`\}/);
    assert.match(page, /absolute inset-0/);
    assert.match(page, /pointer-events-none/);
    assert.match(page, /pointer-events-auto/);
  });
});
