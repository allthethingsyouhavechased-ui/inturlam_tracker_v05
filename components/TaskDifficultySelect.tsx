"use client";

import { useTransition } from "react";
import { setTaskDifficultyAction } from "@/lib/actions/tasks";
import {
  TASK_DIFFICULTIES,
  TASK_DIFFICULTY_BADGE,
  TASK_DIFFICULTY_LABEL,
} from "@/lib/constants";
import type { TaskDifficulty } from "@/lib/types";

export default function TaskDifficultySelect({
  taskId,
  difficulty,
}: {
  taskId: string;
  difficulty: TaskDifficulty | null;
}) {
  const [pending, startTransition] = useTransition();
  const activeClass = difficulty
    ? TASK_DIFFICULTY_BADGE[difficulty]
    : "border border-dashed border-border-strong bg-surface-subtle text-muted";

  return (
    <select
      aria-label="Zorluk derecesi"
      value={difficulty ?? ""}
      disabled={pending}
      onChange={(event) => {
        const next = event.target.value as TaskDifficulty;
        if (next) startTransition(() => setTaskDifficultyAction(taskId, next));
      }}
      className={`cursor-pointer rounded-full px-2.5 py-1 text-xs font-semibold outline-none ${activeClass} ${pending ? "opacity-50" : ""}`}
    >
      {!difficulty && <option value="" disabled>Belirlenmedi</option>}
      {TASK_DIFFICULTIES.map((value) => (
        <option key={value} value={value}>
          {TASK_DIFFICULTY_LABEL[value]}
        </option>
      ))}
    </select>
  );
}
