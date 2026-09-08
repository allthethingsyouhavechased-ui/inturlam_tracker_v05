import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { sortBrandsAlphabetically } from "@/lib/repositories/brands";

function source(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("açılır marka listeleri", () => {
  it("Türkçe alfabetik sırayı ortak yardımcıyla üretir", () => {
    const brands = [
      { id: "3", name: "İzmir" },
      { id: "1", name: "Çınar" },
      { id: "4", name: "Ihlamur" },
      { id: "2", name: "Antek" },
    ];

    assert.deepEqual(
      sortBrandsAlphabetically(brands).map((brand) => brand.name),
      ["Antek", "Çınar", "Ihlamur", "İzmir"],
    );
    assert.deepEqual(brands.map((brand) => brand.name), ["İzmir", "Çınar", "Ihlamur", "Antek"]);
  });

  it("marka seçimi sağlayan bütün sunucu girişleri alfabetik listeyi kullanır", () => {
    for (const file of [
      "app/tasks/page.tsx",
      "app/tasks/archive/page.tsx",
      "app/requests/page.tsx",
      "app/requests/[requestId]/page.tsx",
      "app/team/page.tsx",
      "app/team/manage/guest/page.tsx",
      "app/calendar/page.tsx",
      "app/social/takvim/page.tsx",
      "app/ideas/page.tsx",
      "app/ideas/[ideaId]/page.tsx",
      "lib/actions/quickAdd.ts",
    ]) {
      assert.match(source(file), /listBrandsAlphabetically\(\)/, `${file} alfabetik marka listesini kullanmalı`);
    }
  });
});
