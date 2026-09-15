// Varlık tablosunun sıralama kuralı. Gerçek tarayıcıda yapılan kontrolde
// çıkan hata burada kilitleniyor: eşit sayıya sahip markalar AZALAN
// sıralamada ters alfabetik diziliyordu, çünkü ikinci anahtar da yönle
// birlikte çevriliyordu.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const source = fs.readFileSync(
  path.join(process.cwd(), "components/SocialVarlikTable.tsx"),
  "utf8",
);

describe("varlık tablosu sıralaması", () => {
  it("yönü YALNIZCA birincil karşılaştırmaya uyguluyor", () => {
    // Birincil sonuç sıfırdan farklıysa yön uygulanıp erken dönülüyor;
    // marka adı karşılaştırması ondan SONRA ve yönsüz.
    assert.match(source, /if \(result !== 0\) return sort\.direction === "asc" \? result : -result;/);
    // Eski hatalı desen: tie de negatifleniyordu.
    assert.doesNotMatch(source, /sort\.direction === "asc" \? tie : -tie/);
  });

  it("sayı sütunlarında ilk tıklama çoktan aza", () => {
    assert.match(source, /direction: key === "brand" \? "asc" : "desc"/);
  });
});
