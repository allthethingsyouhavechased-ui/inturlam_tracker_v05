"use client";

import { useEffect } from "react";
import { rememberTaskListFromTarget } from "@/lib/taskListNavigation";

/**
 * Görev bağlantısına tıklandığı anda, bulunulan listeyi (adres + filtreler +
 * kaydırma konumu) dönüş kaynağı olarak yazar. Tek dinleyici layout'ta duruyor:
 * Panom, ekip, marka ve takvim ekranlarının her biri kendi sarmalayıcısını
 * yazmak zorunda kalmasın. İzinli olmayan bir adreste hiç kayıt üretmez
 * (lib/taskListNavigation.ts'teki liste).
 */
export default function TaskOriginTracker() {
  useEffect(() => {
    const onClick = (event: Event) => rememberTaskListFromTarget(event.target);
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
  return null;
}
