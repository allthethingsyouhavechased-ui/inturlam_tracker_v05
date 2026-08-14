"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createPortal } from "react-dom";
import { decideTeamTaskDeliveryAction } from "@/lib/actions/deliveries";
import {
  TASK_REVISION_REASON_LABEL,
  TASK_REVISION_REASONS,
} from "@/lib/constants";
import { getActionErrorMessage } from "@/lib/errorMessage";
import { TASK_REVISION_TARGET_OPTIONS } from "@/lib/taskRevisions";
import { buttonClass } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Input";
import Icon from "@/components/ui/Icon";

const emptySubscribe = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export default function TaskQuickRevisionDialog({
  taskTitle,
  deliveryId,
  deliveryVersion,
}: {
  taskTitle: string;
  deliveryId: string;
  deliveryVersion: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const pendingRef = useRef(pending);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isClient = useIsClient();
  const titleId = `quick-revision-${deliveryId}`;

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !pendingRef.current) {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
    }
    document.addEventListener("keydown", onKey);
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      try {
        await decideTeamTaskDeliveryAction(formData);
        setOpen(false);
      } catch (caught) {
        setError(getActionErrorMessage(caught));
      }
    });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="ui-press inline-flex min-h-7 items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 text-[10px] font-semibold text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950/70"
        aria-haspopup="dialog"
      >
        <Icon name="switch" className="size-3" />
        Revize iste
      </button>

      {open && isClient && createPortal(
        <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-zinc-950/65 p-4 pt-16 backdrop-blur-[2px] sm:pt-24">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Revize penceresini kapat"
            className="absolute inset-0 cursor-default"
            onClick={() => !pending && setOpen(false)}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="ui-enter relative w-full max-w-lg rounded-xl border border-border-default bg-surface-elevated p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-4">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold tracking-[0.09em] text-amber-600 dark:text-amber-300">TESLİM KARARI · V{deliveryVersion}</p>
                <h2 id={titleId} className="mt-1 truncate text-base font-semibold text-foreground">Revize iste</h2>
                <p className="mt-1 truncate text-xs text-muted">{taskTitle}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="ui-press inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-hover hover:text-foreground disabled:opacity-50"
                aria-label="Kapat"
              >
                <Icon name="close" className="size-4" />
              </button>
            </div>

            <form onSubmit={submit} className="mt-4 space-y-3">
              <input type="hidden" name="deliveryId" value={deliveryId} />
              <input type="hidden" name="decision" value="RevizeIstendi" />
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-medium text-secondary">
                  Revize nedeni
                  <select name="revisionReason" required defaultValue="" className={controlClass()} autoFocus>
                    <option value="" disabled>Neden seç</option>
                    {TASK_REVISION_REASONS.map((reason) => (
                      <option key={reason} value={reason}>{TASK_REVISION_REASON_LABEL[reason]}</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-xs font-medium text-secondary">
                  Hedef süre
                  <select name="revisionTargetMinutes" required defaultValue="480" className={controlClass()}>
                    {TASK_REVISION_TARGET_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="grid gap-1.5 text-xs font-medium text-secondary">
                İstenen değişiklikler
                <textarea
                  name="decisionNote"
                  required
                  maxLength={2000}
                  rows={4}
                  placeholder="Revizenin ne olduğunu açıkça yaz…"
                  className={controlClass()}
                />
              </label>
              {error && <p role="alert" className="text-xs text-danger">{error}</p>}
              <div className="flex justify-end gap-2 border-t border-border-subtle pt-4">
                <button type="button" disabled={pending} onClick={() => setOpen(false)} className={buttonClass({ variant: "secondary" })}>
                  Vazgeç
                </button>
                <button type="submit" disabled={pending} className={buttonClass({ className: "bg-amber-600 hover:bg-amber-700" })}>
                  {pending ? "Revize açılıyor…" : "Revizeyi başlat"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
