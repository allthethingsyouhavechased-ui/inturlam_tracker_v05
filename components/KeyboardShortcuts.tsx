"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import {
  FOCUS_SEARCH_EVENT,
  GO_TO_ROUTES,
  QUICK_ADD_OPEN_EVENT,
  SHORTCUT_GROUPS,
  isTypingTarget,
} from "@/lib/shortcuts";

// Portal `document.body`ye gidiyor; sunucuda `document` yok (bkz. QuickAddModal
// içindeki aynı desen ve CLAUDE.md'deki "Portal eden modal SSR'da document arar"
// tuzağı).
const emptySubscribe = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

/** İki tuşlu `g` dizisinin ikinci tuşu için bekleme süresi. */
const CHORD_TIMEOUT_MS = 1200;

export default function KeyboardShortcuts() {
  const router = useRouter();
  const isClient = useIsClient();
  const [helpOpen, setHelpOpen] = useState(false);
  // "g bekliyorum" durumu STATE DEĞİL REF: ekranda hiçbir şey değiştirmiyor,
  // state yapmak her tuş vuruşunda gereksiz bir render turu demek olurdu.
  const chordRef = useRef<number | null>(null);

  const clearChord = useCallback(() => {
    if (chordRef.current !== null) {
      window.clearTimeout(chordRef.current);
      chordRef.current = null;
    }
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;

      if (event.key === "Escape") {
        clearChord();
        setHelpOpen(false);
        return;
      }

      // Metin yazarken hiçbir tek harf kısayolu çalışmaz.
      if (isTypingTarget(event.target)) return;
      // Ctrl/Cmd/Alt kombinasyonları tarayıcının ve GlobalSearch'ün (Ctrl+K).
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();

      // `g` beklemedeyken gelen ikinci tuş hedefi seçer.
      if (chordRef.current !== null) {
        clearChord();
        const target = GO_TO_ROUTES[key];
        if (target) {
          event.preventDefault();
          router.push(target.href);
        }
        return;
      }

      if (key === "g") {
        chordRef.current = window.setTimeout(clearChord, CHORD_TIMEOUT_MS);
        return;
      }

      if (key === "?") {
        event.preventDefault();
        setHelpOpen((open) => !open);
        return;
      }

      if (key === "n") {
        event.preventDefault();
        window.dispatchEvent(new Event(QUICK_ADD_OPEN_EVENT));
        return;
      }

      if (key === "/") {
        event.preventDefault();
        window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT));
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      clearChord();
    };
  }, [router, clearChord]);

  if (!helpOpen || !isClient) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/60 p-4 backdrop-blur-[2px]">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Pencereyi kapat"
        className="absolute inset-0 cursor-default"
        onClick={() => setHelpOpen(false)}
      />
      {/* Klavyeyle açıldığı için giriş animasyonu YOK — bkz. lib/shortcuts.ts. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        className="relative max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-border-default bg-surface-elevated p-5 shadow-lg"
      >
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-border-subtle pb-3">
          <div>
            <p className="text-eyebrow text-brand-600 dark:text-brand-300">KLAVYE</p>
            <h2 id="shortcuts-title" className="mt-1 text-h2 text-foreground">Kısayollar</h2>
          </div>
          <button
            type="button"
            onClick={() => setHelpOpen(false)}
            className="ui-press inline-flex size-9 items-center justify-center rounded-[9px] text-muted hover:bg-surface-hover hover:text-foreground"
            aria-label="Kapat"
          >
            <Icon name="close" className="size-[17px]" />
          </button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="mb-2 text-eyebrow text-muted">{group.title.toLocaleUpperCase("tr-TR")}</h3>
              <ul className="flex flex-col gap-1.5">
                {group.items.map((item) => (
                  <li key={`${group.title}-${item.keys.join("-")}`} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-[13px] text-secondary">{item.label}</span>
                    <span className="flex shrink-0 items-center gap-1">
                      {item.keys.map((key) => (
                        <kbd
                          key={key}
                          className="rounded-md border border-border-default bg-surface px-1.5 py-0.5 font-sans text-[10px] font-medium tabular-nums text-muted shadow-sm"
                        >
                          {key}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-5 border-t border-border-subtle pt-3 text-caption text-muted">
          Bir metin alanına yazarken kısayollar devre dışıdır. Git kısayolları için önce
          <kbd className="mx-1 rounded-md border border-border-default bg-surface px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted">G</kbd>
          ardından hedef harfe bas.
        </p>
      </div>
    </div>,
    document.body,
  );
}
