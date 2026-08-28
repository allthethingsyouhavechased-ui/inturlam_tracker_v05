import type { IconName } from "@/lib/icons";

// Klavye kısayolları — saf tanım. `"use client"` DEĞİL: hem kısayolları dinleyen
// istemci bileşeni hem de yardım penceresi bu listeyi okuyor, ayrıca sunucu
// tarafında render edilen bir yerde gösterilmek istenirse çalışsın.
//
// Emil kuralı: klavyeyle tetiklenen aksiyon ANİMASYONSUZ açılır. Günde yüzlerce
// kez yapılan bir hareketin 220ms beklemesi, kısayolun kazandırdığı süreyi geri
// alıyor — bu yüzden `QUICK_ADD_OPEN_EVENT` ile açılan pencere giriş animasyonunu
// atlar (bkz. components/QuickAddModal.tsx).

/** Hızlı görev penceresini açar. */
export const QUICK_ADD_OPEN_EVENT = "inturlam:quick-add-open";
/** Üst çubuktaki aramaya odaklanır. */
export const FOCUS_SEARCH_EVENT = "inturlam:focus-search";

export interface ShortcutHint {
  readonly keys: readonly string[];
  readonly label: string;
  readonly icon?: IconName;
}

export interface ShortcutGroup {
  readonly title: string;
  readonly items: readonly ShortcutHint[];
}

/** `g` ile başlayan iki tuşlu gitme kısayolları: ikinci tuş → hedef yol. */
export const GO_TO_ROUTES: Readonly<Record<string, { href: string; label: string }>> = {
  b: { href: "/", label: "Bugün" },
  p: { href: "/panom", label: "Panom" },
  g: { href: "/tasks", label: "Görevler" },
  m: { href: "/brands", label: "Markalar" },
  s: { href: "/social", label: "Sosyal" },
  f: { href: "/ideas", label: "Fikir Bankası" },
  e: { href: "/team", label: "Ekip" },
  t: { href: "/calendar", label: "Takvim" },
  r: { href: "/reports", label: "Raporlar" },
};

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    title: "İşlem",
    items: [
      { keys: ["N"], label: "Yeni görev penceresi", icon: "plus" },
      { keys: ["/"], label: "Aramaya odaklan", icon: "search" },
      { keys: ["Ctrl", "K"], label: "Aramaya odaklan", icon: "search" },
      { keys: ["?"], label: "Bu listeyi aç/kapat" },
      { keys: ["Esc"], label: "Açık pencereyi kapat" },
    ],
  },
  {
    title: "Git",
    items: Object.entries(GO_TO_ROUTES).map(([key, target]) => ({
      keys: ["G", key.toUpperCase()],
      label: target.label,
    })),
  },
];

/**
 * Kısayol yutulmamalı: kullanıcı bir metin alanına yazıyorsa "n" harfi görev
 * penceresi açmaz. `contenteditable` de sayılır — yorum kutusu bir gün zengin
 * metin editörüne dönerse burası kendiliğinden doğru kalsın.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
