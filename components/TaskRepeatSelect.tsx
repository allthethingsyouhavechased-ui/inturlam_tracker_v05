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
    // Etiket ("Tekrar") çağıranın kendi <label>'ında; burada tekrar yazılması
    // yan sütunda aynı kelimeyi iki kez gösteriyordu.
    <span className="flex w-full min-w-0 items-center gap-1.5">
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
        className="min-h-9 w-full min-w-0 rounded-md border border-border-default bg-background px-2 py-1 text-xs outline-none focus:border-brand-500 disabled:opacity-50"
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
