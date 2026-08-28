"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/ui/Icon";
import {
  getPendingUndo,
  getServerUndoSnapshot,
  subscribeUndo,
} from "@/lib/undoQueue";

// Bekleyen yıkıcı işlemin tek görünen yüzü. Uygulamada bir kez (layout'ta)
// duruyor; hangi ekranda silme yapıldığının önemi yok.
const emptySubscribe = () => () => {};
const useIsClient = () =>
  useSyncExternalStore(emptySubscribe, () => true, () => false);

export default function UndoBar() {
  const pending = useSyncExternalStore(subscribeUndo, getPendingUndo, getServerUndoSnapshot);
  const isClient = useIsClient();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!pending) return;
    // Kalan süreyi göstermek için saniyede ~10 kare yeter; `requestAnimationFrame`
    // ile sürekli döndürmek 6 saniyelik bir sayaç için israf olurdu.
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [pending]);

  if (!pending || !isClient) return null;

  const total = pending.expiresAt - pending.startedAt;
  const remaining = Math.max(0, pending.expiresAt - now);
  const remainingSeconds = Math.ceil(remaining / 1000);
  const progress = total > 0 ? remaining / total : 0;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
    >
      <div className="ui-enter flex items-center gap-3 rounded-full border border-border-default bg-surface-elevated py-2 pl-4 pr-2 shadow-lg">
        <span className="text-[13px] text-foreground">{pending.message}</span>

        {/* Kalan süre hem yazıyla hem halkayla: yalnız renk/şekil ile anlatılan
            bir bilgi bırakma kuralı burada da geçerli. */}
        <span className="flex items-center gap-1.5 text-caption tabular-nums text-muted">
          <svg viewBox="0 0 20 20" className="size-4" aria-hidden="true">
            <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.2" />
            <circle
              cx="10"
              cy="10"
              r="8"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 8}
              strokeDashoffset={2 * Math.PI * 8 * (1 - progress)}
              transform="rotate(-90 10 10)"
            />
          </svg>
          {remainingSeconds}sn
        </span>

        <button
          type="button"
          onClick={pending.undo}
          className="ui-press inline-flex min-h-9 items-center gap-1.5 rounded-full bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700"
        >
          <Icon name="undo" className="size-3.5" />
          Geri al
        </button>
      </div>
    </div>,
    document.body,
  );
}
