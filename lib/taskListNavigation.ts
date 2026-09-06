import type { MouseEvent } from "react";
const KEY = "inturlam.taskListReturn";
export function readTaskListReturn(): { href: string; scroll: number; taskPath: string } | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(KEY) ?? "null");
    if (!value || !/^\/tasks(?:\?|$)/.test(value.href) || !/^\/tasks\/[^/?]+$/.test(value.taskPath) || !Number.isFinite(value.scroll)) return null;
    return value;
  } catch { return null; }
}
export function rememberTaskList(event: MouseEvent<HTMLElement>) {
  const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
  if (!link || link.origin !== window.location.origin || !/^\/tasks\/[^/?]+$/.test(link.pathname)) return;
  try { sessionStorage.setItem(KEY, JSON.stringify({ href: window.location.pathname + window.location.search, scroll: window.scrollY, taskPath: link.pathname })); } catch { /* Optional browser persistence. */ }
}
export function restoreTaskListScroll() {
  const saved = readTaskListReturn();
  if (saved?.href !== window.location.pathname + window.location.search) return;
  const frame = requestAnimationFrame(() => window.scrollTo(0,saved.scroll));
  return () => cancelAnimationFrame(frame);
}
