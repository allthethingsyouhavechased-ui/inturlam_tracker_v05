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
        className="min-h-11 w-full min-w-0 rounded-md border border-border-default bg-surface px-2.5 py-1 text-xs text-foreground outline-none transition-[border-color,box-shadow,opacity] hover:border-border-strong focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-8 md:w-auto"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      disabled={pending}
      title="Teslim tarihini değiştir"
      className={`ui-press inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border-default bg-surface px-2.5 tabular-nums text-xs hover:border-border-strong hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-50 md:min-h-8 md:w-auto md:justify-start ${
        dueDate && isOverdue(dueDate)
          ? "font-medium text-danger"
          : "text-muted"
      }`}
    >
      {dueDate ? formatDateShort(dueDate) : "—"}
    </button>
  );
}
