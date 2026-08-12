"use client";

import { useState, useTransition } from "react";
import { setTaskDueDateAction } from "@/lib/actions/tasks";
import { formatDateShort, isOverdue } from "@/lib/date";

export default function TaskDueDateEdit({
  taskId,
  dueDate,
}: {
  taskId: string;
  dueDate: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editing) {
    return (
      <input
        type="date"
        required
        autoFocus
        defaultValue={dueDate ?? ""}
        disabled={pending}
        onBlur={() => setEditing(false)}
        onChange={(e) => {
          const next = e.target.value;
          if (!next) return;
          startTransition(() => setTaskDueDateAction(taskId, next));
          setEditing(false);
        }}
        className="min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs outline-none transition-[border-color,box-shadow] focus:border-brand-500 disabled:opacity-50 dark:border-white/15 dark:bg-zinc-900"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={pending}
      title="Teslim tarihini değiştir"
      className={`ui-press inline-flex min-h-11 items-center rounded-lg px-2.5 tabular-nums text-xs underline decoration-dotted underline-offset-2 hover:bg-black/5 hover:decoration-solid disabled:opacity-50 dark:hover:bg-white/10 ${
        dueDate && isOverdue(dueDate)
          ? "font-medium text-rose-600 dark:text-rose-400"
          : "text-zinc-500 dark:text-zinc-400"
      }`}
    >
      {dueDate ? formatDateShort(dueDate) : "—"}
    </button>
  );
}
