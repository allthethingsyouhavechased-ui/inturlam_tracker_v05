"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import Icon from "@/components/ui/Icon";
import {
  markAllGuestNotificationsReadAction,
  markGuestNotificationReadAction,
} from "@/lib/actions/guestNotifications";
import { formatDateTime } from "@/lib/date";
import type { Notification } from "@/lib/types";

export default function GuestNotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: Notification[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [locallyRead, setLocallyRead] = useState<ReadonlySet<string>>(new Set());
  const [, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const unread = Math.max(
    0,
    unreadCount - notifications.filter((item) => item.read === 0 && locallyRead.has(item.id)).length,
  );

  useEffect(() => {
    if (!open) return;
    function closeOnOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function markRead(id: string) {
    if (locallyRead.has(id)) return;
    setLocallyRead((current) => new Set(current).add(id));
    startTransition(() => markGuestNotificationReadAction(id));
  }

  return (
    <div ref={containerRef} className="relative ml-auto sm:ml-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={unread > 0 ? `Bildirimler (${unread} okunmamış)` : "Bildirimler"}
        aria-expanded={open}
        className="touch-target ui-press relative inline-flex size-10 items-center justify-center rounded-[10px] text-muted hover:bg-surface-hover hover:text-foreground"
      >
        <Icon name="bell" className="size-[18px]" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold leading-none text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="ui-enter absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border-default bg-surface-elevated p-2 shadow-md">
          <div className="flex items-center justify-between gap-3 px-2 py-1">
            <h2 className="text-sm font-semibold text-foreground">Bildirimler</h2>
            <button
              type="button"
              disabled={unread === 0}
              onClick={() => {
                setLocallyRead(new Set(notifications.filter((item) => item.read === 0).map((item) => item.id)));
                startTransition(() => markAllGuestNotificationsReadAction());
              }}
              className="text-xs font-medium text-brand-600 hover:underline disabled:text-faint disabled:no-underline"
            >
              Tümünü okundu yap
            </button>
          </div>
          <ul className="max-h-96 space-y-0.5 overflow-y-auto">
            {notifications.length === 0 && <li className="px-2 py-5 text-center text-sm text-muted">Henüz bildiriminiz yok.</li>}
            {notifications.map((item) => {
              const unreadItem = item.read === 0 && !locallyRead.has(item.id);
              const month = item.calendar_event_start_at?.slice(0, 7);
              return (
                <li key={item.id}>
                  <Link
                    href={month ? `/guest/calendar?month=${month}` : "/guest/calendar"}
                    onClick={() => { markRead(item.id); setOpen(false); }}
                    className={`flex gap-2.5 rounded-lg px-2 py-2 hover:bg-surface-hover ${unreadItem ? "bg-brand-50 dark:bg-brand-950/40" : ""}`}
                  >
                    <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                      <Icon name="calendar" className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm leading-5 ${unreadItem ? "font-medium text-foreground" : "text-secondary"}`}>{item.summary}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        {unreadItem && <span className="size-1.5 rounded-full bg-brand-600" />}
                        {formatDateTime(item.created_at)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
