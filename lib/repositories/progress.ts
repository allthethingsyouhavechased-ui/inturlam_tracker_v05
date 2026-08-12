import { getDb, plainList } from "@/lib/db/client";
import { calculateMonthlyProgress, TASK_STATUS_COEFFICIENT } from "@/lib/progress";
import type { MonthlyProgress, TaskStatus } from "@/lib/types";

interface ProgressTaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  weight_points: number;
  brand_id: string;
  brand_name: string;
}

export interface TaskContribution extends ProgressTaskRow {
  contribution_points: number;
}

function validMonth(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Geçersiz ay.");
  return month;
}

function listProgressTasks(month: string, whereSql = "", params: string[] = []): ProgressTaskRow[] {
  return plainList<ProgressTaskRow>(
    getDb().prepare(
      `SELECT t.id, t.title, t.status, t.weight_points, b.id AS brand_id, b.name AS brand_name
         FROM tasks t
         JOIN content_items ci ON ci.id = t.content_item_id
         JOIN brands b ON b.id = ci.brand_id
        WHERE substr(t.due_date, 1, 7) = ? ${whereSql}
        ORDER BY b.sort_order, b.name, t.due_date, t.created_at`,
    ).all(validMonth(month), ...params),
  );
}

export function getBrandMonthlyProgress(brandId: string, month: string): MonthlyProgress {
  return calculateMonthlyProgress(month, listProgressTasks(month, "AND b.id = ?", [brandId]));
}

export function listBrandMonthlyContributions(brandId: string, month: string): TaskContribution[] {
  return listProgressTasks(month, "AND b.id = ?", [brandId]).map((task) => ({
    ...task,
    contribution_points: Number((task.weight_points * TASK_STATUS_COEFFICIENT[task.status]).toFixed(2)),
  }));
}

export function getPersonMonthlyProgress(personId: string, month: string): MonthlyProgress {
  return calculateMonthlyProgress(month, listProgressTasks(month, "AND t.assignee_id = ?", [personId]));
}

export function listPersonMonthlyContributions(personId: string, month: string): TaskContribution[] {
  return listProgressTasks(month, "AND t.assignee_id = ?", [personId]).map((task) => ({
    ...task,
    contribution_points: Number((task.weight_points * TASK_STATUS_COEFFICIENT[task.status]).toFixed(2)),
  }));
}

export function listTeamMonthlyProgress(month: string): Array<{ person_id: string; person_name: string; progress: MonthlyProgress }> {
  const people = plainList<{ person_id: string; person_name: string }>(
    getDb().prepare("SELECT id AS person_id, name AS person_name FROM people WHERE active = 1 ORDER BY name").all(),
  );
  return people.map((person) => ({ ...person, progress: getPersonMonthlyProgress(person.person_id, month) }));
}
