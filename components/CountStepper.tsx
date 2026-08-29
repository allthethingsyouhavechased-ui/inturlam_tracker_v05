"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getActionErrorMessage } from "@/lib/errorMessage";
import { clampCount, parseCountInput } from "@/lib/socialPlan";

const DEBOUNCE_MS = 400;

// Hem marka hedefi (BrandContentTargetsSection) hem varlık sayfasının
// kullandığı ortak "−/+ ve sayıya tıkla-yaz" sayaç. `value` prop'unu
// `useEffect` ile state'e YANSITMAZ (react-hooks/set-state-in-effect yasak,
// bkz. CLAUDE.md) — `useState(initialValue)` ile bir kez tohumlanır, sonrası
// tamamen yerel; aynı değeri başka bir sekmeden değiştirmek bu bileşeni
// otomatik güncellemez (sayfa yenilenince prop tazelenir).
//
// −/+ arka arkaya tıklanınca her tık AYRI bir yazma yapmaz: 400ms boyunca
// hareketsiz kalınca TEK, MUTLAK değer gönderilir (delta değil) — yarışan bir
// yazma olsa bile son gönderilen kazanır (bkz. plan: "eşzamanlılık" notu).
//
// Sayının üstüne tıklayınca <input>'a döner ama yalnızca blur/Enter'da
// kaydeder; React'in onChange'i yarım yazılmış değerde de tetiklendiği için
// (TaskTargetDateEdit.tsx'teki "15" yazarken önce "1" gelmesi dersinin aynısı)
// boş/NaN girişi `parseCountInput` sessizce yok sayar, kaydetmeyi tetiklemez.
export default function CountStepper({
  value: initialValue,
  onSave,
  label,
}: {
  value: number;
  onSave: (next: number) => Promise<void>;
  label: string;
}) {
  const [value, setValue] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef(initialValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  function commit(next: number) {
    const clamped = clampCount(next);
    setValue(clamped);
    setError(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const previous = lastSaved.current;
      startTransition(async () => {
        try {
          await onSave(clamped);
          lastSaved.current = clamped;
        } catch (cause) {
          setValue(previous);
          setError(getActionErrorMessage(cause));
        }
      });
    }, DEBOUNCE_MS);
  }

  if (editing) {
    return (
      <span className="inline-flex flex-col">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          autoFocus
          defaultValue={value}
          aria-label={label}
          disabled={pending}
          onBlur={(event) => {
            setEditing(false);
            const parsed = parseCountInput(event.target.value);
            if (parsed !== null) commit(parsed);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            else if (event.key === "Escape") setEditing(false);
          }}
          className="w-14 rounded-md border border-brand-400 bg-white px-1.5 py-1 text-center text-sm tabular-nums outline-none focus:border-brand-500 dark:border-brand-700 dark:bg-zinc-900"
        />
        {error && (
          <span role="alert" className="max-w-24 text-[10px] text-danger">
            {error}
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        onClick={() => commit(value - 1)}
        disabled={pending || value <= 0}
        aria-label={`${label} azalt`}
        className="touch-target ui-press grid size-7 place-items-center rounded-md border border-brand-500/30 bg-brand-500/[0.05] text-sm text-brand-700 hover:border-brand-500/50 hover:bg-brand-500/10 disabled:opacity-40 dark:text-brand-300"
      >
        −
      </button>
      <button
        type="button"
        onClick={() => setEditing(true)}
        disabled={pending}
        aria-label={`${label}: ${value}, değiştirmek için tıkla`}
        className="min-w-8 rounded-md px-1 py-1 text-center text-sm font-semibold tabular-nums text-brand-700 underline decoration-dotted underline-offset-2 hover:bg-brand-500/[0.08] hover:decoration-solid disabled:opacity-50 dark:text-brand-300"
      >
        {value}
      </button>
      <button
        type="button"
        onClick={() => commit(value + 1)}
        disabled={pending}
        aria-label={`${label} artır`}
        className="touch-target ui-press grid size-7 place-items-center rounded-md border border-brand-500/30 bg-brand-500/[0.05] text-sm text-brand-700 hover:border-brand-500/50 hover:bg-brand-500/10 disabled:opacity-40 dark:text-brand-300"
      >
        +
      </button>
      {error && (
        <span role="alert" className="max-w-24 text-[10px] text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
