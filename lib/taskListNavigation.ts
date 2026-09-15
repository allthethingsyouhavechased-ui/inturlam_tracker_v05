import type { MouseEvent } from "react";

const KEY = "inturlam.taskListReturn";

// Görevin AÇILDIĞI kaynak ekran. Eskiden yalnızca `/tasks` kabul ediliyordu:
// Panom'dan açılan görev kapatılınca kullanıcı Panom yerine görev listesine
// düşüyordu. Artık uygulama içi şu listeler de dönüş kaynağı olabiliyor —
// liste izinli DEĞİLSE kayıt hiç yazılmaz (açık yönlendirme riski yok).
const ALLOWED_RETURN_PATHS: readonly RegExp[] = [
  /^\/$/, // ana pano
  /^\/tasks$/,
  /^\/tasks\/archive$/,
  /^\/tasks\/planning$/,
  /^\/panom$/,
  /^\/panom\/katkim$/,
  /^\/panom\/markalar$/,
  /^\/calendar$/,
  /^\/search$/,
  /^\/team$/,
  /^\/team\/[^/?#]+$/,
  /^\/brands\/[^/?#]+$/,
  /^\/brands\/[^/?#]+\/content\/[^/?#]+$/,
  /^\/requests$/,
  /^\/activity$/,
];

const TASK_PATH = /^\/tasks\/[^/?#]+$/;

export function isAllowedReturnPath(pathname: string): boolean {
  return ALLOWED_RETURN_PATHS.some((pattern) => pattern.test(pathname));
}

/** Kayıttaki adresi doğrular: uygulama içi, izinli liste ve mutlak yol olmalı. */
function isAllowedReturnHref(href: unknown): href is string {
  if (typeof href !== "string" || !href.startsWith("/") || href.startsWith("//")) return false;
  const pathname = href.split(/[?#]/, 1)[0];
  return isAllowedReturnPath(pathname);
}

export function readTaskListReturn(): { href: string; scroll: number; taskPath: string } | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (!value || !isAllowedReturnHref(value.href) || !TASK_PATH.test(value.taskPath) || !Number.isFinite(value.scroll)) return null;
    return value;
  } catch { return null; }
}

/** Tıklanan öğeden görev bağlantısını bulur ve o anki listeyi dönüş kaynağı yazar. */
export function rememberTaskListFromTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return;
  const link = target.closest<HTMLAnchorElement>('a[href]');
  if (!link || link.origin !== window.location.origin || !TASK_PATH.test(link.pathname)) return;
  const href = window.location.pathname + window.location.search;
  if (!isAllowedReturnHref(href)) return;
  try { sessionStorage.setItem(KEY, JSON.stringify({ href, scroll: window.scrollY, taskPath: link.pathname })); } catch { /* Optional browser persistence. */ }
}

export function rememberTaskList(event: MouseEvent<HTMLElement>) {
  rememberTaskListFromTarget(event.target);
}

export function restoreTaskListScroll() {
  const saved = readTaskListReturn();
  if (saved?.href !== window.location.pathname + window.location.search) return;
  const frame = requestAnimationFrame(() => window.scrollTo(0,saved.scroll));
  return () => cancelAnimationFrame(frame);
}

/** Dönüş bağlantısının etiketi — kullanıcı nereye döneceğini okumadan bilsin. */
export function returnLabelForHref(href: string): string {
  const pathname = href.split(/[?#]/, 1)[0];
  if (pathname === "/panom" || pathname.startsWith("/panom/")) return "Panom'a dön";
  if (pathname === "/") return "Panoya dön";
  if (pathname === "/calendar") return "Takvime dön";
  if (pathname === "/search") return "Arama sonuçlarına dön";
  if (pathname === "/requests") return "Taleplere dön";
  if (pathname === "/activity") return "Etkinlik akışına dön";
  if (pathname.startsWith("/team")) return "Ekip sayfasına dön";
  if (pathname.startsWith("/brands/")) return "Marka sayfasına dön";
  return "Görev listesine dön";
}
