import type { TaskDifficulty } from "@/lib/types";

export type TaskDueFilter = "" | "overdue" | "today" | "week" | "undated";
export type TaskRevisionFilter = "" | "none" | "active" | "completed" | "overdue" | "three-plus";

export interface TaskMetadataFilterInput {
  due: TaskDueFilter;
  difficulty: TaskDifficulty | "" | "unset";
  revision: TaskRevisionFilter;
  today: string;
  weekEnd: string;
  dateFrom: string;
  dateTo: string;
}

export interface TaskMetadataShape {
  due_date: string | null;
  difficulty: TaskDifficulty | null;
  revision_count: number;
  active_revision_id: string | null;
  active_revision_elapsed_minutes: number | null;
  active_revision_target_minutes: number | null;
}

export function isRevisionOverTarget(
  elapsedMinutes: number | null,
  targetMinutes: number | null,
): boolean {
  return elapsedMinutes !== null && targetMinutes !== null && elapsedMinutes > targetMinutes;
}

export function formatRevisionDuration(totalMinutes: number | null): string {
  if (totalMinutes === null || totalMinutes < 1) return "0 dk";
  const minutes = Math.floor(totalMinutes);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainder = minutes % 60;
  const parts: string[] = [];
  if (days > 0) parts.push(`${days} gün`);
  if (hours > 0) parts.push(`${hours} sa`);
  if (remainder > 0 && days === 0) parts.push(`${remainder} dk`);
  return parts.join(" ");
}

export function matchesTaskMetadataFilters(
  task: TaskMetadataShape,
  filters: TaskMetadataFilterInput,
): boolean {
  const dueDate = task.due_date;
  if (filters.due === "undated" && dueDate !== null) return false;
  if (filters.due === "overdue" && (!dueDate || dueDate >= filters.today)) return false;
  if (filters.due === "today" && dueDate !== filters.today) return false;
  if (
    filters.due === "week" &&
    (!dueDate || dueDate < filters.today || dueDate > filters.weekEnd)
  ) return false;
  if (filters.dateFrom && (!dueDate || dueDate < filters.dateFrom)) return false;
  if (filters.dateTo && (!dueDate || dueDate > filters.dateTo)) return false;

  if (filters.difficulty === "unset" && task.difficulty !== null) return false;
  if (
    filters.difficulty &&
    filters.difficulty !== "unset" &&
    task.difficulty !== filters.difficulty
  ) return false;

  const active = task.active_revision_id !== null;
  const overTarget = isRevisionOverTarget(
    task.active_revision_elapsed_minutes,
    task.active_revision_target_minutes,
  );
  if (filters.revision === "none" && task.revision_count !== 0) return false;
  if (filters.revision === "active" && !active) return false;
  if (filters.revision === "completed" && (task.revision_count === 0 || active)) return false;
  if (filters.revision === "overdue" && !overTarget) return false;
  if (filters.revision === "three-plus" && task.revision_count < 3) return false;
  return true;
}
