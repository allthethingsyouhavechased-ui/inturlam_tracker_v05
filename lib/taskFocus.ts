import type { TaskStatus } from "@/lib/types";

export const TASK_FOCUS_VALUES = ["open", "overdue", "week"] as const;

export type TaskFocus = (typeof TASK_FOCUS_VALUES)[number];

export const TASK_FOCUS_LABEL: Record<TaskFocus, string> = {
  open: "Açık görevler",
  overdue: "Gecikmiş",
  week: "Bu hafta",
};

export function parseTaskFocus(value: string | undefined): TaskFocus | "" {
  return TASK_FOCUS_VALUES.includes(value as TaskFocus) ? value as TaskFocus : "";
}

export function matchesTaskFocus(
  task: { status: TaskStatus; due_date: string | null },
  focus: TaskFocus | "",
  today: string,
  weekEnd: string,
): boolean {
  if (!focus) return true;
  if (task.status === "Yayinlandi") return false;
  if (focus === "open") return true;
  if (!task.due_date) return false;
  if (focus === "overdue") return task.due_date < today;
  return task.due_date >= today && task.due_date <= weekEnd;
}
