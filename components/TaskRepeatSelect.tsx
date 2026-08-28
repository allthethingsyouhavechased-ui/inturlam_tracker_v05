"use client";

import { useState, useTransition } from "react";
import { setTaskRepeatAction } from "@/lib/actions/tasks";
import { REPEAT_OPTIONS } from "@/lib/constants";
import { getActionErrorMessage } from "@/lib/errorMessage";

// Tekrar eden görev: görev "Yayınlandı" yapılınca bir sonraki örneği otomatik
// açılır (lib/actions/tasks.ts). Seçim anında kaydedilir, ayrı kaydet düğmesi yok.
export default function TaskRepeatSelect({
  taskId,
  repeatDays,
}: {
  taskId: string;
  repeatDays: number | null;
}) {
  const [value, setValue] = useState(repeatDays ?? 0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-xs text-zinc-500 dark:text-zinc-400">Tekrar</span>
      <select
        aria-label="Tekrar aralığı"
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = Number(e.target.value);
          const previous = value;
          setValue(next);
          setError(null);
          startTransition(async () => {
            try {
              await setTaskRepeatAction(taskId, next);
            } catch (err) {
              setValue(previous);
              setError(getActionErrorMessage(err));
            }
          });
        }}
        className="rounded-md border border-black/10 bg-white px-2 py-1 text-xs outline-none focus:border-brand-500 disabled:opacity-50 dark:border-white/15 dark:bg-zinc-900"
      >
        {REPEAT_OPTIONS.map((o) => (
          <option key={o.days} value={o.days}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}
