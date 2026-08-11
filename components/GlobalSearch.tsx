"use client";

import { useEffect, useRef } from "react";
import Icon from "@/components/ui/Icon";

export default function GlobalSearch() {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === inputRef.current) {
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <form action="/search" method="GET" role="search" className="hidden min-w-0 max-w-[30rem] flex-1 md:block">
      <label className="relative block">
        <span className="sr-only">Marka, içerik veya görev ara</span>
        <Icon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 size-[17px] -translate-y-1/2 text-muted"
        />
        <input
          ref={inputRef}
          type="search"
          name="q"
          placeholder="Marka, içerik veya görev ara"
          className="h-10 w-full rounded-[10px] border border-border-default bg-surface-subtle pl-10 pr-16 text-[13px] text-foreground outline-none transition-[background-color,border-color,box-shadow] placeholder:text-muted hover:border-border-strong focus:border-brand-500 focus:bg-surface focus:ring-2 focus:ring-brand-500/15"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-border-default bg-surface px-1.5 py-0.5 font-sans text-[10px] font-medium text-muted shadow-sm">
          Ctrl K
        </kbd>
      </label>
    </form>
  );
}
