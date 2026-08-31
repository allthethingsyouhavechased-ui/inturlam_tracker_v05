// Yeni etkinlik penceresinin varsayılan saat aralığı: seçili günün 09:00–10:00'u.
//
// Bu kural eskiden `scripts/smoke-local.mts` içinde, sayfanın HTML'inde
// `value="<gün>T09:00"` aranarak doğrulanıyordu. 2026-08-28'deki v04 yenilemesi
// pencereyi `open && isClient && createPortal(...)` ile YALNIZCA istemcide
// çizilir hale getirdi (SSR'da `document` yok — CLAUDE.md'deki "Portal eden modal"
// tuzağı). O günden sonra alanlar sunucudan çekilen HTML'de hiç bulunmuyor, yani
// o assert hiçbir koşulda geçemezdi; uygulamada bir arıza yoktu, kontrol bayattı.
//
// Kural `newEventFormRange` olarak saf fonksiyona çıkarıldı ve burada gerçekten
// test ediliyor. Saatler değişirse (ör. 10:00–11:00) bu test tutar.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { newEventFormRange } from "@/lib/calendar/time";

describe("newEventFormRange", () => {
  it("seçili günü 09:00 başlangıç ve 10:00 bitiş alanlarına taşır", () => {
    assert.deepEqual(newEventFormRange("2026-08-01"), {
      start: "2026-08-01T09:00",
      end: "2026-08-01T10:00",
    });
  });

  it("başlangıç ve bitiş aynı güne düşer, bitiş başlangıçtan sonradır", () => {
    const { start, end } = newEventFormRange("2026-12-31");
    assert.equal(start.slice(0, 10), "2026-12-31");
    assert.equal(end.slice(0, 10), "2026-12-31");
    assert.ok(start < end);
  });

  it("datetime-local girdisinin beklediği biçimi üretir", () => {
    // <input type="datetime-local"> yalnızca "YYYY-MM-DDTHH:mm" kabul eder;
    // saniye veya saat dilimi eki eklenirse alan sessizce boş açılır.
    const { start, end } = newEventFormRange("2026-02-29");
    for (const value of [start, end]) {
      assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    }
  });
});
