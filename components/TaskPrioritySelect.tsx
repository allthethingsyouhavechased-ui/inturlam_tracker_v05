"use client";

import { useTransition } from "react";
import { setTaskPriorityAction } from "@/lib/actions/tasks";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_BADGE,
  TASK_PRIORITY_LABEL,
} from "@/lib/constants";
import type { TaskPriority } from "@/lib/types";

export default function TaskPrioritySelect({
  taskId,
  priority,
}: {
  taskId: string;
  priority: TaskPriority;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="Öncelik"
      value={priority}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as TaskPriority;
        startTransition(() => setTaskPriorityAction(taskId, next));
      }}
      className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold outline-none ${TASK_PRIORITY_BADGE[priority]} ${pending ? "opacity-50" : ""}`}
    >
      {TASK_PRIORITIES.map((p) => (
        <option key={p} value={p}>
          {TASK_PRIORITY_LABEL[p]}
        </option>
      ))}
    </select>
  );
}
