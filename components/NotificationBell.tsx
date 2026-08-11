"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import PersonAvatar from "@/components/PersonAvatar";
import Icon from "@/components/ui/Icon";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions/notifications";
import { formatDateTime } from "@/lib/date";
import type { Notification } from "@/lib/types";

export default function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: Notification[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  // Bu oturumda elle "okundu" işaretlenen bildirim id'leri. Sunucudan gelen
  // `notifications`/`unreadCount` prop'larını yerel state'e KOPYALAMIYORUZ —
  // bu, prop her değiştiğinde bir useEffect içinde setState çağırmayı
  // gerektirirdi (react-hooks/set-state-in-effect kuralına takılır, bkz.
  // CLAUDE.md'deki SidebarContext notu). Bunun yerine yalnızca "iyimser
  // override" kümesini tutuyoruz; ekrana çizilen liste/rozet her render'da
  // prop + override'dan TÜRETİLİYOR, hiç senkronizasyon gerekmiyor.
  const [locallyRead, setLocallyRead] = useState<ReadonlySet<string>>(new Set());
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const items = notifications.map((n) =>
    n.read === 0 && locallyRead.has(n.id) ? { ...n, read: 1 } : n,
  );
  const unreadDelta = notifications.reduce(
    (acc, n) => acc + (n.read === 0 && locallyRead.has(n.id) ? 1 : 0),
    0,
  );
  const unread = Math.max(0, unreadCount - unreadDelta);

  // Dışarı tıklama veya Escape ile kapat. Header'ın `backdrop-blur`ı yalnızca
  // `position: fixed` torunları için "containing block" tuzağı yaratıyor
  // (bkz. QuickAddModal) — bu panel `absolute` + zil'e göre konumlandığı için
  // o tuzağa hiç girmiyor, portal'a gerek yok.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function handleItemClick(n: Notification) {
    setOpen(false);
    if (n.read === 1 || locallyRead.has(n.id)) return;
    setLocallyRead((prev) => new Set(prev).add(n.id));
    startTransition(() => {
      markNotificationReadAction(n.id);
    });
  }

  function handleMarkAllRead() {
    const unreadIds = notifications.filter((n) => n.read === 0 && !locallyRead.has(n.id));
    if (unreadIds.length === 0) return;
    setLocallyRead((prev) => {
      const next = new Set(prev);
      for (const n of unreadIds) next.add(n.id);
      return next;
    });
    startTransition(() => {
      markAllNotificationsReadAction();
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread > 0 ? `Bildirimler (${unread} okunmamış)` : "Bildirimler"}
        aria-expanded={open}
        aria-haspopup="true"
        className="touch-target ui-press relative inline-flex size-10 items-center justify-center rounded-[10px] text-muted hover:bg-surface-hover hover:text-foreground"
      >
        <Icon name="bell" className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="ui-enter absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border-default bg-surface-elevated p-2 shadow-md">
          <div className="flex items-center justify-between px-2 py-1">
            <h2 className="text-sm font-semibold">Bildirimler</h2>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={unread === 0}
              className="text-xs font-medium text-brand-600 hover:underline disabled:cursor-default disabled:text-zinc-400 disabled:no-underline dark:text-brand-400 dark:disabled:text-zinc-600"
            >
              tümünü okundu işaretle
            </button>
          </div>
          <ul className="max-h-96 space-y-0.5 overflow-y-auto">
            {items.length === 0 && (
              <li className="px-2 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
                Henüz bildirimin yok.
              </li>
            )}
            {items.map((n) => {
              const unreadItem = n.read === 0;
              const content = (
                <>
                  {n.actor_name ? (
                    <PersonAvatar name={n.actor_name} size="xs" />
                  ) : (
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                      ?
                    </span>
                  )}
                  <div className="min-w-0 flex-1 text-sm">
                    <span
                      className={
                        unreadItem
                          ? "font-medium text-zinc-900 dark:text-zinc-50"
                          : "text-zinc-600 dark:text-zinc-300"
                      }
                    >
                      {n.summary}
                    </span>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {unreadItem && (
                        <span
                          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-600 dark:bg-brand-400"
                          aria-hidden="true"
                        />
                      )}
                      <span className="whitespace-nowrap tabular-nums">
                        {formatDateTime(n.created_at)}
                      </span>
                    </div>
                  </div>
                </>
              );
              return (
                <li key={n.id}>
                  {n.task_id ? (
                    <Link
                      href={`/tasks/${n.task_id}`}
                      onClick={() => handleItemClick(n)}
                      className={`flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ${
                        unreadItem ? "bg-brand-50 dark:bg-brand-950/40" : ""
                      }`}
                    >
                      {content}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleItemClick(n)}
                      className={`flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04] ${
                        unreadItem ? "bg-brand-50 dark:bg-brand-950/40" : ""
                      }`}
                    >
                      {content}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
