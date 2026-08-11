"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import Icon from "@/components/ui/Icon";
import { useSidebar } from "./SidebarContext";

export default function SidebarMobileFrame({ children }: { children: React.ReactNode }) {
  const { open, close } = useSidebar();
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeWhenDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) close();
    };
    desktop.addEventListener("change", closeWhenDesktop);
    return () => desktop.removeEventListener("change", closeWhenDesktop);
  }, [close]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>("[data-sidebar-close]")?.focus();
    }, 100);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [open, close]);

  return (
    <>
      {open && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Menüyü kapat"
          className="fixed inset-0 z-40 bg-zinc-950/60 backdrop-blur-[2px] md:hidden"
          onClick={close}
        />
      )}
      <div
        ref={panelRef}
        id="app-sidebar"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label={open ? "Ana gezinme" : undefined}
        className={`sidebar-panel invisible fixed inset-y-0 left-0 z-50 w-72 -translate-x-full bg-surface shadow-lg transition-[transform,visibility] duration-200 md:visible md:sticky md:top-0 md:z-auto md:h-screen md:w-auto md:shrink-0 md:self-start md:translate-x-0 md:bg-transparent md:shadow-none ${
          open ? "visible translate-x-0" : ""
        }`}
      >
        {open && (
          <button
            type="button"
            onClick={close}
            data-sidebar-close
            className="ui-press absolute right-3 top-3 z-10 inline-flex size-10 items-center justify-center rounded-[10px] border border-border-default bg-surface text-muted shadow-sm hover:bg-surface-hover hover:text-foreground md:hidden"
            aria-label="Menüyü kapat"
          >
            <Icon name="close" className="size-[18px]" />
          </button>
        )}
        {children}
      </div>
    </>
  );
}
