"use client";

import { useTransition } from "react";
import { setTaskWeightAction } from "@/lib/actions/tasks";

export default function TaskWeightSelect({ taskId, weight }: { taskId: string; weight: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <input
      type="number"
      min={1}
      max={100}
      step={1}
      defaultValue={weight}
      disabled={pending}
      onBlur={(event) => {
        const next = Number(event.currentTarget.value);
        if (Number.isInteger(next) && next !== weight) startTransition(() => setTaskWeightAction(taskId, next));
      }}
      className="min-h-10 w-full rounded-[10px] border border-border-default bg-background px-3 text-sm outline-none focus:border-brand-500 disabled:opacity-50"
      aria-label="Görev ağırlığı"
    />
  );
}
