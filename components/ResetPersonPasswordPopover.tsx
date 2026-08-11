"use client";

import { useEffect, useId, useRef, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import { resetPersonPasswordAction } from "@/lib/actions/people";
import { getActionErrorMessage } from "@/lib/errorMessage";

export default function ResetPersonPasswordPopover({
  personId,
  personName,
  needsPassword,
}: {
  personId: string;
  personName: string;
  needsPassword: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setError(null);
          setOpen((value) => !value);
        }}
        className={`ui-press inline-flex min-h-9 items-center gap-1.5 rounded-[9px] px-2.5 text-xs font-semibold ${
          needsPassword
            ? "bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-300"
            : "text-secondary hover:bg-surface-hover hover:text-foreground"
        }`}
      >
        <Icon name="shield" className="size-3.5" />
        {needsPassword ? "İlk şifreyi belirle" : "Şifreyi yenile"}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-labelledby={`${panelId}-title`}
          className="ui-enter absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-border-default bg-surface p-4 shadow-[0_18px_44px_rgba(0,0,0,0.2)]"
        >
          <div className="mb-4">
            <h3 id={`${panelId}-title`} className="text-sm font-semibold text-foreground">
              {needsPassword ? "İlk giriş şifresi" : "Şifreyi yenile"}
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted">
              {personName} için en az 8 karakterli bir şifre belirle. Açık oturumları kapatılır.
            </p>
          </div>
          <form
            ref={formRef}
            action={async (formData) => {
              setError(null);
              try {
                await resetPersonPasswordAction(formData);
                formRef.current?.reset();
                setOpen(false);
              } catch (caught) {
                setError(getActionErrorMessage(caught));
              }
            }}
            className="space-y-3"
          >
            <input type="hidden" name="personId" value={personId} />
            <label className="grid gap-1.5 text-xs font-semibold text-secondary">
              Yeni şifre
              <Input name="password" type="password" minLength={8} maxLength={128} required autoComplete="new-password" />
            </label>
            <label className="grid gap-1.5 text-xs font-semibold text-secondary">
              Yeni şifre tekrar
              <Input name="confirmPassword" type="password" minLength={8} maxLength={128} required autoComplete="new-password" />
            </label>
            {error && <p role="alert" className="text-xs text-danger">{error}</p>}
            <div className="flex justify-end border-t border-border-subtle pt-3">
              <SubmitButton>{needsPassword ? "Şifreyi etkinleştir" : "Şifreyi yenile"}</SubmitButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
