"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Sayfayı arka planda periyodik olarak tazeler, böylece başka birinin
 * yaptığı değişiklik F5'e gerek kalmadan görünür. Gerçek zamanlı push değil
 * (WebSocket yok) — pragmatik bir orta yol.
 *
 * Aralık 15 sn değil 40 sn: bu bileşenin bulunduğu sayfaların hepsi
 * `force-dynamic` ve çoğu tüm görev listesini okuyor, yani her tetikleme TAM bir
 * RSC render'ı demek. 12 kişi × birkaç sekme × 15 sn dakikada yüzlerce render
 * ediyordu; 40 sn'de ekip için algılanan tazelik aynı kalıyor, sunucu yükü
 * üçte birine iniyor.
 *
 * `hasFocus()` de kontrol ediliyor: `visibilityState` ikinci bir monitörde açık
 * duran ama kimsenin bakmadığı sekmede hâlâ "visible" döner.
 */
export default function AutoRefresh({ intervalMs = 40000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible" && document.hasFocus()) {
        router.refresh();
      }
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
