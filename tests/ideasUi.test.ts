import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

function source(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("Fikir Bankası ürün bağlantıları", () => {
  it("yeni fikir düğmesinin açtığı modalı kapsam, kategori, kaynak ve etiketlerle kurar", () => {
    const explorer = source("components/IdeaBankExplorer.tsx");
    const page = source("app/ideas/page.tsx");
    const trigger = source("components/IdeaCreateButton.tsx");
    for (const name of ["brandId", "category", "title", "body", "sourceUrl", "tags"]) {
      assert.match(explorer, new RegExp(`name=["']${name}["']`), `${name} alanı eksik`);
    }
    assert.match(page, /<IdeaCreateButton \/>/);
    assert.match(trigger, /OPEN_IDEA_DIALOG_EVENT/);
    assert.match(explorer, /role="dialog"/);
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

  it("marka dizinini kategori gruplarından bağımsız Türkçe alfabetik sırada kurar", () => {
    const explorer = source("components/IdeaBankExplorer.tsx");
    assert.match(explorer, /const sortedBrands = \[\.\.\.brands\]\.sort/);
    assert.match(explorer, /left\.name\.localeCompare\(right\.name, "tr", \{ sensitivity: "base" \}\)/);
    assert.match(explorer, /\{sortedBrands\.map\(\(brand\) =>/);
    assert.doesNotMatch(explorer, /brandGroups/);
    assert.match(explorer, /ideaCountByBrand/);
    assert.match(explorer, /officeIdeaCount/);
    assert.match(explorer, /chooseScope\(brand\.id\)/);
    assert.match(explorer, /setQuery\(""\);\s+setCategory\(ALL\);\s+setStatus\(ALL\);\s+setScope\(nextScope\)/);
  });

  it("ana ekran ve detay seçicisi markaları Türkçe alfabetik sırada sunar", () => {
    for (const file of ["app/ideas/page.tsx", "app/ideas/[ideaId]/page.tsx"]) {
      assert.match(source(file), /listBrandsAlphabetically\(\)/);
    }
  });

  it("marka detayındaki fikir kısayolu sayacı korur ve filtrelenmiş akışa iner", () => {
    const brandPage = source("app/brands/[brandId]/page.tsx");
    assert.match(brandPage, /countIdeasForBrand\(brandId\)/);
    assert.match(brandPage, /ideas\?brand=\$\{encodeURIComponent\(brand\.id\)\}#fikir-akisi/);
  });
});
