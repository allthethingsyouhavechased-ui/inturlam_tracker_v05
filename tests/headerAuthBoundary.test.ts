import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

function source(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

describe("üst çubuk veri sınırı", () => {
  const header = source("components/Header.tsx");

  it("oturum yokken hiçbir kişisel veriyi okumaz ve görev oluşturucuyu çizmez", () => {
    assert.match(header, /const notifications = person \? listNotificationsForPerson\(person\.id\) : \[\];/);
    assert.match(header, /const unreadCount = person \? countUnreadForPerson\(person\.id\) : 0;/);
    assert.match(header, /\{person && \(\s*<QuickAddModal/);
  });

  it("layout'ta duran üst çubuk marka/içerik/kişi listelerini HİÇ okumaz", () => {
    // Header her istekte çalışıyor. Bu üç sorgu bir dönem burada duruyordu ve
    // yalnızca KAPALI hızlı görev penceresini besliyordu — üç tam tablo, her
    // sayfa yüklemesinde. Artık pencere ilk açılışta kendisi çekiyor.
    for (const call of ["listBrands(", "listAllContentSummaries(", "listActivePeople("]) {
      assert.ok(
        !header.includes(call),
        `${call} Header'a geri gelmiş — layout'taki her istek bu sorguyu çalıştırır`,
      );
    }
  });

  it("hızlı görev penceresi açılır listelerini oturum korumalı bir action'dan çeker", () => {
    const action = source("lib/actions/quickAdd.ts");
    const modal = source("components/QuickAddModal.tsx");

    assert.match(action, /"use server"/);
    assert.match(action, /await requireSession\(\)/);
    assert.match(modal, /loadQuickAddOptionsAction\(\)/);
    // İstek yalnızca bir kez gitmeli: guard state değil ref (efekt gövdesinde
    // senkron setState `react-hooks/set-state-in-effect`e takılıyor).
    assert.match(modal, /requestedOptionsRef\.current = true;/);
  });
});
