"use client";

import { useEffect, useId, useRef, useState } from "react";
import NewPersonForm from "@/components/NewPersonForm";
import Button from "@/components/ui/Button";

export default function NewPersonPopover() {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <Button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <svg viewBox="0 0 20 20" fill="none" className="size-4" aria-hidden="true">
          <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Yeni ekip üyesi
      </Button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-labelledby={`${panelId}-title`}
          className="ui-enter absolute right-0 z-20 mt-2 w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-border-default bg-surface p-4 shadow-lg"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 id={`${panelId}-title`} className="text-sm font-semibold text-foreground">
                Yeni ekip üyesi ekle
              </h3>
              <p className="mt-0.5 text-xs text-muted">
                İsim, departman ve ilk giriş şifresini birlikte belirle.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Yeni ekip üyesi panelini kapat"
              className="touch-target ui-press grid size-11 place-items-center rounded-md text-lg leading-none text-muted hover:bg-surface-hover hover:text-foreground md:size-9"
            >
              ×
            </button>
          </div>
          <NewPersonForm onSuccess={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
