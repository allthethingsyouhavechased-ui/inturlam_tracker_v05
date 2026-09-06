"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Button from "@/components/ui/Button";

export default function PageActionDialog({ open, onOpenChange, triggerLabel, title, description, children }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerLabel: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  return <>
    <Button ref={triggerRef} variant="secondary" aria-haspopup="dialog" aria-expanded={open} onClick={() => onOpenChange(true)}>
      {triggerLabel}
    </Button>
    {open && createPortal(
      <dialog ref={dialogRef} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
        onCancel={() => onOpenChange(false)}
        onClick={event => { if (event.target === event.currentTarget) onOpenChange(false); }}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-3rem)] w-[calc(100%-1.5rem)] max-w-2xl overflow-y-auto rounded-xl border border-border-default bg-surface-elevated p-0 text-foreground shadow-2xl backdrop:bg-zinc-950/65 backdrop:backdrop-blur-[2px]">
        <div>
          <header className="flex items-start justify-between gap-4 border-b border-border-subtle p-4 sm:p-5">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
              {description && <p id={descriptionId} className="mt-2 text-xs leading-5 text-muted">{description}</p>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Kapat</Button>
          </header>
          <div className="min-w-0 p-4 text-left sm:p-5">{children}</div>
        </div>
      </dialog>, document.body,
    )}
  </>;
}
