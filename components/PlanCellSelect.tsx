"use client";

import { useTransition } from "react";
import { setBrandPlanEntryAction } from "@/lib/actions/socialPlan";
import { PLAN_COMBOS } from "@/lib/socialPlan";

// Paylaşım takvimi hücresi — Tier A deseni (TaskStatusSelect ile aynı): değer
// doğrudan prop'tan gelir, yerel state yok, seçim anında kaydedilir. Boş
// seçenek satırı SİLER (action null alınca DELETE yapar, bkz.
// lib/repositories/socialPlan.ts'teki setBrandPlanEntry).
export default function PlanCellSelect({
  brandId,
  date,
  combo,
}: {
  brandId: string;
  date: string;
  combo: string | null;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      aria-label={`${date} paylaşım planı`}
      value={combo ?? ""}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value || null;
        startTransition(() => setBrandPlanEntryAction(brandId, date, next));
      }}
      className={`min-h-9 w-full rounded-md border px-1 text-[11px] outline-none transition-colors focus:border-brand-500 disabled:opacity-50 ${
        combo
          ? "border-brand-300 bg-brand-50 font-medium text-brand-800 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-200"
          : "border-black/10 bg-white text-zinc-400 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-600"
      }`}
    >
      <option value="">—</option>
      {PLAN_COMBOS.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}
