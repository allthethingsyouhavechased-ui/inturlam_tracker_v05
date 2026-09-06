"use client";

import { useState, useTransition } from "react";
import { setTaskStatusAction } from "@/lib/actions/tasks";
import { TASK_STATUS_BADGE, TASK_STATUS_LABEL, TASK_STATUSES } from "@/lib/constants";
import type { TaskStatus } from "@/lib/types";

export default function TaskStatusSelect({
  taskId,
  status,
  locked = false,
}: {
  taskId: string;
  status: TaskStatus;
  locked?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div>
    <select
      aria-label="Durum"
      value={status}
      disabled={pending || locked}
      title={locked ? "Önce iç teslim tarihi atanmalı" : undefined}
      onChange={(e) => {
        const next = e.target.value as TaskStatus;
        setError(null);
        startTransition(async () => {
          try { const result = await setTaskStatusAction(taskId, next); if (!result.ok) setError(result.error); }
          catch { setError("Durum güncellenemedi. Bağlantınızı kontrol edip yeniden deneyin."); }
        });
      }}
      className={`min-h-11 w-full rounded-md border-0 px-2.5 py-1 text-xs font-semibold outline-none transition-[box-shadow,opacity] focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-8 md:w-auto ${TASK_STATUS_BADGE[status]} ${pending || locked ? "cursor-not-allowed" : "cursor-pointer"}`}
    >
      {TASK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {TASK_STATUS_LABEL[s]}
        </option>
      ))}
    </select>
    {error && <p role="alert" className="mt-1 max-w-xs text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
