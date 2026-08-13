import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

function source(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Fikir Bankası ürün bağlantıları", () => {
  it("hızlı kayıt formunu kapsam, kategori, kaynak ve etiketlerle kurar", () => {
    const explorer = source("components/IdeaBankExplorer.tsx");
    for (const name of ["brandId", "category", "title", "body", "sourceUrl", "tags"]) {
      assert.match(explorer, new RegExp(`name=["']${name}["']`), `${name} alanı eksik`);
    }
    assert.match(explorer, /Ofis geneli/);
    assert.match(explorer, /Instagram, TikTok, Pinterest, YouTube/);
    assert.match(explorer, /updateIdeaStatusAction/);
  });

  it("ana navigasyon, marka detayı, global arama ve aktivite akışına bağlıdır", () => {
    assert.match(source("lib/nav.ts"), /href: "\/ideas"/);
    assert.match(source("app/brands/[brandId]/page.tsx"), /\/ideas\?brand=/);
    assert.match(source("app/search/page.tsx"), /results\.ideas/);
    assert.match(source("components/ActivityFeed.tsx"), /\/ideas\/\$\{e\.entity_id\}/);
  });

  it("liste görünümü kapsam, kategori, durum ve Türkçe metin araması sunar", () => {
    const explorer = source("components/IdeaBankExplorer.tsx");
    assert.match(explorer, /toLocaleLowerCase\("tr-TR"\)/);
    assert.match(explorer, /scope !== ALL/);
    assert.match(explorer, /idea\.category !== category/);
    assert.match(explorer, /idea\.status !== status/);
  });
});
