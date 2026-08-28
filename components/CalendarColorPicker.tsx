"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { CALENDAR_EVENT_COLORS } from "@/lib/calendar/colors";
import type { CalendarEventColor } from "@/lib/types";
import Icon from "@/components/ui/Icon";

function ColorSwatch({ color }: { color: CalendarEventColor }) {
  if (color === "auto") {
    return (
      <span
        aria-hidden="true"
        className="grid size-4 shrink-0 grid-cols-3 overflow-hidden rounded-full ring-1 ring-black/10 dark:ring-white/20"
      >
        <span className="bg-sky-500" />
        <span className="bg-violet-500" />
        <span className="bg-zinc-500" />
      </span>
    );
  }
  const item = CALENDAR_EVENT_COLORS.find((candidate) => candidate.key === color)!;
  return (
    <span
      aria-hidden="true"
      className={`size-4 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20 ${item.dotClass}`}
    />
  );
}

export default function CalendarColorPicker({
  defaultValue,
}: {
  defaultValue: CalendarEventColor;
}) {
  const [selected, setSelected] = useState<CalendarEventColor>(defaultValue);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLFieldSetElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const paletteRef = useRef<HTMLDivElement>(null);
  const paletteId = useId();
  const selectedColor = CALENDAR_EVENT_COLORS.find((color) => color.key === selected)!;

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  function openPalette() {
    setOpen(true);
    requestAnimationFrame(() => {
      paletteRef.current
        ?.querySelector<HTMLElement>(`[data-color-key="${selected}"]`)
        ?.focus();
    });
  }

  function selectColor(color: CalendarEventColor) {
    setSelected(color);
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function handlePaletteKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const options = Array.from(paletteRef.current?.querySelectorAll<HTMLElement>("[role='option']") ?? []);
    if (!options.length) return;
    const currentIndex = Math.max(0, options.indexOf(document.activeElement as HTMLElement));
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? options.length - 1
        : (currentIndex + (event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
    options[nextIndex]?.focus();
  }

  return (
    <fieldset
      ref={rootRef}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
      className="relative w-fit max-w-full min-w-0"
    >
      <legend className="mb-1.5 text-xs font-medium text-secondary">Etkinlik rengi</legend>
      <select
        key={selected}
        name="colorKey"
        defaultValue={selected}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      >
        {CALENDAR_EVENT_COLORS.map((color) => (
          <option key={color.key} value={color.key}>{color.label}</option>
        ))}
      </select>
      <button
        ref={triggerRef}
        type="button"
        data-calendar-color-trigger
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={paletteId}
        onClick={() => open ? setOpen(false) : openPalette()}
        className="ui-press flex h-9 w-48 max-w-full items-center justify-between gap-3 rounded-lg border border-border-default bg-background px-3 text-xs font-medium text-foreground hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ColorSwatch color={selected} />
          <span className="truncate">{selectedColor.label}</span>
        </span>
        <Icon name="chevron-down" className={`size-3.5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          ref={paletteRef}
          id={paletteId}
          role="listbox"
          aria-label="Etkinlik rengi seçenekleri"
          data-calendar-color-palette
          onKeyDown={handlePaletteKeyDown}
          className="absolute left-0 top-full z-30 mt-1.5 grid w-max grid-cols-6 gap-1.5 rounded-xl border border-border-default bg-surface-elevated p-2 shadow-xl"
        >
          {CALENDAR_EVENT_COLORS.map((color) => (
            <button
              key={color.key}
              type="button"
              role="option"
              aria-selected={selected === color.key}
              aria-label={color.label}
              title={color.label}
              tabIndex={selected === color.key ? 0 : -1}
              data-color-key={color.key}
              onClick={() => selectColor(color.key)}
              className={`ui-press grid size-8 place-items-center rounded-full outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-elevated ${selected === color.key ? "ring-2 ring-foreground ring-offset-2 ring-offset-surface-elevated" : ""}`}
            >
              <ColorSwatch color={color.key} />
            </button>
          ))}
        </div>
      )}
    </fieldset>
  );
}
