"use client";

import { useTransition } from "react";
import { setTaskStatusAction } from "@/lib/actions/tasks";
import { TASK_STATUS_BADGE, TASK_STATUS_LABEL, TASK_STATUSES } from "@/lib/constants";
import type { TaskStatus } from "@/lib/types";

export default function TaskStatusSelect({
  taskId,
  status,
}: {
  taskId: string;
  status: TaskStatus;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="Durum"
      value={status}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as TaskStatus;
        startTransition(() => setTaskStatusAction(taskId, next));
      }}
      className={`min-h-8 cursor-pointer rounded-md border-0 px-2 py-1 text-[10px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${TASK_STATUS_BADGE[status]} ${pending ? "opacity-50" : ""}`}
    >
      {TASK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {TASK_STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
