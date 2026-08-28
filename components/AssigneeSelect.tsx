"use client";

import { useTransition } from "react";
import { setTaskAssigneeAction } from "@/lib/actions/tasks";
import type { Person } from "@/lib/types";

const base =
  "min-h-11 w-full cursor-pointer rounded-md border border-border-default bg-surface px-2.5 py-1 text-xs text-foreground outline-none transition-[border-color,box-shadow,opacity] hover:border-border-strong focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-50 md:min-h-8 md:w-auto";

export default function AssigneeSelect({
  taskId,
  assigneeId,
  people,
}: {
  taskId: string;
  assigneeId: string | null;
  people: Person[];
}) {
  const [pending, startTransition] = useTransition();
  return (
    <select
      aria-label="Atanan"
      value={assigneeId ?? ""}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value || null;
        startTransition(() => setTaskAssigneeAction(taskId, next));
      }}
      className={base}
    >
      <option value="">— kimse —</option>
      {people.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
