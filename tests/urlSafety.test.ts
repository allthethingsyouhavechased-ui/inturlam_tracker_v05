import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeHttpUrl } from "@/lib/urlSafety";

// Denetim bulgusu SEC-02: Apify'dan gelen `url` alanı şema doğrulaması olmadan
// `href` olarak render ediliyordu — `javascript:` şemalı bir kayıt tıklanabilir
// bir XSS'e dönerdi. Guard hem yazma (lib/social/apify.ts) hem render
// (app/social/takip/page.tsx) tarafında bu fonksiyona dayanıyor.

describe("dış bağlantı şema doğrulaması", () => {
  it("script çalıştırabilecek şemaları eler", () => {
    assert.equal(safeHttpUrl("javascript:alert(document.cookie)"), null);
    assert.equal(safeHttpUrl("JavaScript:alert(1)"), null);
    assert.equal(safeHttpUrl("  javascript:alert(1)  "), null);
    assert.equal(safeHttpUrl("data:text/html,<script>alert(1)</script>"), null);
    assert.equal(safeHttpUrl("vbscript:msgbox(1)"), null);
    assert.equal(safeHttpUrl("file:///C:/Windows/system.ini"), null);
  });

  it("ayrıştırılamayan ve boş değerlerde bağlantı vermez", () => {
    assert.equal(safeHttpUrl(null), null);
    assert.equal(safeHttpUrl(undefined), null);
    assert.equal(safeHttpUrl(""), null);
    assert.equal(safeHttpUrl("   "), null);
    assert.equal(safeHttpUrl("/brands/kahveci"), null);
    assert.equal(safeHttpUrl("instagram.com/kahvecihb"), null);
  });

  it("normal http/https adreslerini korur (regresyon)", () => {
    assert.equal(
      safeHttpUrl("https://www.instagram.com/p/ABC123/"),
      "https://www.instagram.com/p/ABC123/",
    );
    assert.equal(safeHttpUrl("http://sunucu:3000/tasks"), "http://sunucu:3000/tasks");
  });
});
