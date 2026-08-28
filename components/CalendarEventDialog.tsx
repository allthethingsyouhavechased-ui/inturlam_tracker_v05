"use client";

import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import CalendarColorPicker from "@/components/CalendarColorPicker";
import CalendarDateTimeFields from "@/components/CalendarDateTimeFields";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { cancelCalendarEventAction, saveCalendarEventAction } from "@/lib/actions/calendar";
import { calendarFormEndDate } from "@/lib/calendar/time";
import { clearCalendarDialogParams } from "@/lib/calendar/dialogUrl";
import { getActionErrorMessage } from "@/lib/errorMessage";
import type { CalendarEvent, CalendarEventType } from "@/lib/types";

const subscribeClient = () => () => undefined;

function useIsClient(): boolean {
  return useSyncExternalStore(subscribeClient, () => true, () => false);
}

function localDateTime(value: string): string {
  const date = new Date(value);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date).replace(" ", "T");
}

interface DialogSeed {
  key: string;
  event: CalendarEvent | null;
  day: string;
  brandId: string;
}

export default function CalendarEventDialog({
  brands,
  types,
  selectedEvent,
  selectedDay,
  defaultBrandId,
  defaultDay,
}: {
  brands: Array<{ id: string; name: string }>;
  types: ReadonlyArray<{ value: CalendarEventType; label: string }>;
  selectedEvent?: CalendarEvent;
  selectedDay: string | null;
  defaultBrandId: string;
  defaultDay: string;
}) {
  const initialOpen = Boolean(selectedEvent || selectedDay);
  const [open, setOpen] = useState(initialOpen);
  const [seed, setSeed] = useState<DialogSeed>(() => ({
    key: selectedEvent?.id ?? selectedDay ?? "new-0",
    event: selectedEvent ?? null,
    day: selectedDay ?? defaultDay,
    brandId: selectedEvent?.brand_id ?? defaultBrandId,
  }));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seedCounter = useRef(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const isClient = useIsClient();

  const freshSeed = useCallback((): DialogSeed => {
    seedCounter.current += 1;
    return {
      key: `new-${seedCounter.current}`,
      event: null,
      day: defaultDay,
      brandId: defaultBrandId,
    };
  }, [defaultBrandId, defaultDay]);

  const cleanUrl = useCallback(() => {
    const next = clearCalendarDialogParams(new URL(window.location.href));
    window.history.replaceState(window.history.state, "", next);
  }, []);

  const closeDialog = useCallback(() => {
    setOpen(false);
    setError(null);
    setSeed(freshSeed());
    cleanUrl();
  }, [cleanUrl, freshSeed]);

  useEffect(() => {
    if (!open) return;
    const returnTarget = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDialog();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
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

    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLInputElement>('input[name="title"]')?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      returnTarget?.focus();
    };
  }, [closeDialog, open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await saveCalendarEventAction(new FormData(event.currentTarget));
      closeDialog();
      router.refresh();
    } catch (cause) {
      setError(getActionErrorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  async function handleCancelEvent() {
    if (!seed.event || !window.confirm("Bu etkinlik iptal edilsin mi?")) return;
    setError(null);
    setPending(true);
    try {
      await cancelCalendarEventAction(seed.event.id);
      closeDialog();
      router.refresh();
    } catch (cause) {
      setError(getActionErrorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  const event = seed.event;
  const allDay = event?.all_day === 1;
  const start = event
    ? allDay ? event.start_at.slice(0, 10) : localDateTime(event.start_at)
    : `${seed.day}T09:00`;
  const end = event
    ? allDay ? calendarFormEndDate(event) : localDateTime(event.end_at)
    : `${seed.day}T10:00`;

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        size="sm"
        aria-haspopup="dialog"
        onClick={() => {
          setSeed(freshSeed());
          setError(null);
          setOpen(true);
        }}
      >
        <Icon name="plus" className="size-4" /> Yeni etkinlik
      </Button>

      {open && isClient && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/65 p-3 pt-6 backdrop-blur-[2px] sm:p-6 sm:pt-10">
          <button type="button" tabIndex={-1} aria-label="Etkinlik penceresini kapat" className="absolute inset-0 cursor-default" onClick={closeDialog} />
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="calendar-dialog-title"
            aria-describedby="calendar-dialog-description"
            className="ui-enter relative w-full max-w-2xl overflow-hidden rounded-xl border border-border-default bg-surface-elevated shadow-2xl outline-none"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">{event ? "ETKİNLİK" : "YENİ KAYIT"}</p>
                <h2 id="calendar-dialog-title" className="mt-1 text-lg font-semibold text-foreground">{event ? "Etkinliği düzenle" : "Yeni etkinlik"}</h2>
                <p id="calendar-dialog-description" className="mt-1 text-xs leading-5 text-muted">Takvim kaydını, görünürlüğünü ve zaman aralığını tek yerde yönet.</p>
              </div>
              <button type="button" onClick={closeDialog} aria-label="Kapat" className="ui-press grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-foreground">
                <Icon name="close" className="size-4" />
              </button>
            </header>

            <form key={seed.key} onSubmit={handleSubmit} className="max-h-[calc(100dvh-7rem)] space-y-4 overflow-y-auto p-4 sm:p-6">
              {event && <input type="hidden" name="eventId" value={event.id} />}
              <label className="grid gap-1.5 text-xs font-medium text-secondary">
                Başlık
                <Input name="title" required maxLength={200} defaultValue={event?.title ?? ""} />
              </label>

              <CalendarDateTimeFields
                brands={brands}
                types={types}
                initialType={event?.type ?? "Toplanti"}
                initialBrandId={event?.brand_id ?? seed.brandId}
                initialGuestVisible={event?.guest_visible === 1}
                initialAllDay={allDay}
                initialStart={start}
                initialEnd={end}
              />

              <label className="grid gap-1.5 text-xs font-medium text-secondary">
                Konum
                <Input name="location" maxLength={300} defaultValue={event?.location ?? ""} />
              </label>
              <CalendarColorPicker defaultValue={event?.color_key ?? "auto"} />
              <label className="grid gap-1.5 text-xs font-medium text-secondary">
                Açıklama
                <Textarea name="description" maxLength={5000} rows={3} defaultValue={event?.description ?? ""} className="resize-y" />
              </label>

              {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-danger dark:bg-rose-950/30">{error}</p>}

              <footer className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4">
                <Button type="submit" disabled={pending}>{pending ? "Kaydediliyor…" : event ? "Değişiklikleri kaydet" : "Etkinlik oluştur"}</Button>
                <Button type="button" variant="secondary" disabled={pending} onClick={closeDialog}>Vazgeç</Button>
                {event && <Button type="button" variant="ghost" disabled={pending} onClick={handleCancelEvent} className="text-danger hover:bg-rose-50 hover:text-danger dark:hover:bg-rose-950/30">Etkinliği iptal et</Button>}
              </footer>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
