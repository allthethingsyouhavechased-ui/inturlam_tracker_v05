import type { TaskWithContext } from "@/lib/types";

export type PersonalFocus = "all" | "today" | "overdue" | "revision";
export const PERSONAL_FOCUS_LABELS: Record<PersonalFocus, string> = {
  all: "Tüm işlerim", today: "Bugün yapacaklarım", overdue: "Geciken işlerim", revision: "Revizelerim",
};

export function matchesPersonalFocus(task: TaskWithContext, focus: PersonalFocus, today: string): boolean {
  if (focus === "all") return true;
  if (task.archived_at || task.status === "Yayinlandi") return false;
  if (focus === "revision") return task.active_revision_id != null;
  if (focus === "overdue") return task.due_date !== null && task.due_date < today;
  return task.due_date === today && (task.status === "Beklemede" || task.status === "DevamEdiyor");
}

export function personalFocusCounts(tasks: TaskWithContext[], today: string): Record<PersonalFocus, number> {
  return Object.fromEntries((Object.keys(PERSONAL_FOCUS_LABELS) as PersonalFocus[])
    .map((focus) => [focus, tasks.filter((task) => matchesPersonalFocus(task, focus, today)).length])) as Record<PersonalFocus, number>;
}
