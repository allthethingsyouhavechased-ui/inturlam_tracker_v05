"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Icon from "@/components/ui/Icon";
import type { IconName } from "@/lib/icons";
import { deleteTaskAction, setTaskArchivedAction } from "@/lib/actions/tasks";
import { restoreArchivedTaskAction } from "@/lib/actions/tasks";
import { taskArchiveMenuLabel } from "@/lib/taskArchiveLabel";
import { runUndoable } from "@/lib/undoQueue";
import type { TaskStatus } from "@/lib/types";

// Pano ve liste görünümünde karta SAĞ TIKLAYINCA açılan işlem menüsü.
// Aynı işlemler için karta girip çıkmak gerekmesin diye: bir işi iptal etmek
// tek sağ tık + tek tıklama.
//
// Portal `document.body`ye gidiyor — menü kartın `overflow` sınırına takılmasın
// (bkz. QuickAddModal'daki aynı SSR gerekçesi: sunucuda `document` yok).
const emptySubscribe = () => () => {};
const useIsClient = () =>
  useSyncExternalStore(emptySubscribe, () => true, () => false);

export interface TaskMenuTarget {
  readonly id: string;
  readonly title: string;
  readonly archived: boolean;
  readonly status: TaskStatus;
}

interface MenuItem {
  readonly label: string;
  readonly icon: IconName;
  readonly onSelect: () => void;
  readonly tone?: "danger";
}

export default function TaskContextMenu({
  target,
  canDelete,
  onClose,
  position,
}: {
  target: TaskMenuTarget;
  canDelete: boolean;
  onClose: () => void;
  position: { x: number; y: number };
}) {
  const router = useRouter();
  const isClient = useIsClient();
  const menuRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();
  const [placement, setPlacement] = useState(position);

  // Menü ekranın sağ/alt kenarından taşmasın: ölçüp içeri çekiyoruz.
  useEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(position.x, window.innerWidth - rect.width - 8);
    const y = Math.min(position.y, window.innerHeight - rect.height - 8);
    if (x !== position.x || y !== position.y) setPlacement({ x: Math.max(8, x), y: Math.max(8, y) });
  }, [position]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onClose, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [onClose]);

  const href = `/tasks/${target.id}`;

  const items: MenuItem[] = [
    {
      label: "Görevi aç",
      icon: "arrow-right",
      onSelect: () => router.push(href),
    },
    {
      label: "Yeni sekmede aç",
      icon: "panel",
      onSelect: () => window.open(href, "_blank", "noopener,noreferrer"),
    },
    {
      label: "Bağlantıyı kopyala",
      icon: "templates",
      onSelect: () => {
        void navigator.clipboard?.writeText(new URL(href, window.location.origin).toString());
      },
    },
    target.archived
      ? {
        label: taskArchiveMenuLabel(target),
        icon: "undo",
        onSelect: () => startTransition(() => restoreArchivedTaskAction(target.id)),
      }
      : {
        label: taskArchiveMenuLabel(target),
        icon: "archive",
        onSelect: () => startTransition(() => setTaskArchivedAction(target.id, true)),
      },
  ];

  if (canDelete) {
    items.push({
      label: "Görevi sil",
      icon: "close",
      tone: "danger",
      // Silme geri alınabilir: işlem geri alma penceresi dolana kadar sunucuya
      // hiç gitmiyor (bkz. lib/undoQueue.ts).
      onSelect: () => runUndoable({
        message: `“${target.title}” silindi`,
        commit: () => startTransition(() => deleteTaskAction(target.id)),
        rollback: () => {},
      }),
    });
  }

  if (!isClient) return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={`${target.title} işlemleri`}
      style={{ left: placement.x, top: placement.y }}
      className="fixed z-50 min-w-52 overflow-hidden rounded-xl border border-border-default bg-surface-elevated py-1 shadow-lg"
    >
      <p className="truncate px-3 py-1.5 text-[11px] font-medium text-muted">{target.title}</p>
      <div className="my-1 h-px bg-border-subtle" />
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          role="menuitem"
          onClick={() => {
            item.onSelect();
            onClose();
          }}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] hover:bg-surface-hover ${
            item.tone === "danger" ? "text-danger" : "text-secondary hover:text-foreground"
          }`}
        >
          <Icon name={item.icon} className="size-4 shrink-0" />
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}

/**
 * Sağ tık menüsünü açan/kapatan ortak durum. Pano ve liste görünümü aynı
 * menüyü paylaşsın diye burada — iki ayrı kopya çıkarsa biri güncellenip
 * diğeri unutuluyor.
 */
export function useTaskContextMenu() {
  const [state, setState] = useState<{ target: TaskMenuTarget; position: { x: number; y: number } } | null>(null);

  function open(event: React.MouseEvent, target: TaskMenuTarget) {
    event.preventDefault();
    event.stopPropagation();
    setState({ target, position: { x: event.clientX, y: event.clientY } });
  }

  return { state, open, close: () => setState(null) };
}
