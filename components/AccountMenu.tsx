"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import PersonAvatar from "@/components/PersonAvatar";
import Icon from "@/components/ui/Icon";
import { clearIdentity } from "@/lib/actions/identity";
import type { Person } from "@/lib/types";

export default function AccountMenu({ person }: { person: Person }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      const container = containerRef.current;
      if (container && !container.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Hesap menüsünü kapat" : "Hesap menüsünü aç"}
        aria-expanded={open}
        aria-controls={panelId}
        aria-haspopup="true"
        className="ui-press flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] border border-transparent px-1.5 text-left hover:border-border-subtle hover:bg-surface-hover"
      >
        <PersonAvatar name={person.name} avatarPath={person.avatar_path} size="sm" />
        <span className="hidden max-w-28 min-w-0 lg:block">
          <span className="block truncate text-[12px] font-semibold text-foreground">{person.name}</span>
          <span className="block truncate text-[10px] text-muted">{person.title ?? "INTURLAM ekibi"}</span>
        </span>
        <Icon
          name="chevron-down"
          className={`hidden size-4 text-muted transition-transform duration-150 lg:block ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div
          id={panelId}
          aria-label="Hesap seçenekleri"
          className="ui-enter absolute right-0 top-[calc(100%+0.5rem)] z-40 w-64 overflow-hidden rounded-xl border border-border-default bg-surface-elevated p-1.5 shadow-md"
        >
          <div className="border-b border-border-subtle px-2.5 py-2.5">
            <p className="truncate text-[13px] font-semibold text-foreground">{person.name}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted">{person.title ?? "Profil bilgisi eklenmemiş"}</p>
          </div>
          <div className="py-1">
            <Link
              href={`/team/${person.id}`}
              onClick={() => setOpen(false)}
              className="flex min-h-10 items-center gap-2.5 rounded-[9px] px-2.5 text-[13px] text-secondary hover:bg-surface-hover hover:text-foreground"
            >
              <Icon name="user" className="size-[17px] text-muted" />
              Profili görüntüle
            </Link>
            <Link
              href="/settings/profile"
              onClick={() => setOpen(false)}
              className="flex min-h-10 items-center gap-2.5 rounded-[9px] px-2.5 text-[13px] text-secondary hover:bg-surface-hover hover:text-foreground"
            >
              <Icon name="settings" className="size-[17px] text-muted" />
              Profil bilgileri
            </Link>
            <Link
              href="/settings/security"
              onClick={() => setOpen(false)}
              className="flex min-h-10 items-center gap-2.5 rounded-[9px] px-2.5 text-[13px] text-secondary hover:bg-surface-hover hover:text-foreground"
            >
              <Icon name="shield" className="size-[17px] text-muted" />
              Güvenlik
            </Link>
          </div>
          <form action={clearIdentity} className="border-t border-border-subtle pt-1">
            <button type="submit" className="flex min-h-10 w-full items-center gap-2.5 rounded-[9px] px-2.5 text-left text-[13px] text-secondary hover:bg-surface-hover hover:text-foreground">
              <Icon name="switch" className="size-[17px] text-muted" />
              Kimliği değiştir
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
