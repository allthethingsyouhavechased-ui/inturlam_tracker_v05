"use client";

import { useRef, useState } from "react";
import { createTaskAction } from "@/lib/actions/tasks";
import { TASK_PRIORITIES, TASK_PRIORITY_LABEL } from "@/lib/constants";
import { getActionErrorMessage } from "@/lib/errorMessage";
import type { Person } from "@/lib/types";
import SubmitButton from "./SubmitButton";

const inputClass =
  "w-full min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none transition-[border-color,box-shadow] focus:border-brand-500 dark:border-white/15 dark:bg-zinc-900";

export default function NewTaskForm({
  contentItemId,
  people,
  defaultAssigneeId,
}: {
  contentItemId: string;
  people: Person[];
  defaultAssigneeId?: string | null;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => {
        setError(null);
        try {
          await createTaskAction(fd);
          ref.current?.reset();
        } catch (e) {
          setError(getActionErrorMessage(e));
        }
      }}
      className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:items-end"
    >
      <input type="hidden" name="contentItemId" value={contentItemId} />
      <label className="grid gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Görev
        <input
          name="title"
          required
          placeholder="Örn. Çekim, Kurgu, Onay…"
          className={inputClass}
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Öncelik
        <select name="priority" className={inputClass} defaultValue="Normal">
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {TASK_PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Atanan
        <select
          name="assigneeId"
          className={inputClass}
          defaultValue={defaultAssigneeId ?? ""}
        >
          <option value="">— kimse —</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Teslim
        <input type="date" name="dueDate" required className={inputClass} />
      </label>
      <SubmitButton>Ekle</SubmitButton>
      {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400 sm:col-span-5">{error}</p>}
    </form>
  );
}
