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

export interface BrandMonthlyProgressRow {
  brand_id: string;
  brand_name: string;
  brand_logo_path: string | null;
  progress: MonthlyProgress;
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

export function listBrandMonthlyProgress(month: string): BrandMonthlyProgressRow[] {
  const valid = validMonth(month);
  const brands = plainList<{
    brand_id: string;
    brand_name: string;
    brand_logo_path: string | null;
  }>(
    getDb().prepare(
      `SELECT id AS brand_id, name AS brand_name, logo_path AS brand_logo_path
         FROM brands
        WHERE archived = 0
        ORDER BY sort_order, name`,
    ).all(),
  );
  const grouped = new Map<string, ProgressTaskRow[]>();
  for (const task of listProgressTasks(valid)) {
    grouped.set(task.brand_id, [...(grouped.get(task.brand_id) ?? []), task]);
  }
  return brands.map((brand) => ({
    ...brand,
    progress: calculateMonthlyProgress(valid, grouped.get(brand.brand_id) ?? []),
  }));
}

export function getPortfolioMonthlyProgress(month: string): MonthlyProgress {
  const valid = validMonth(month);
  return calculateMonthlyProgress(valid, listProgressTasks(valid));
}

export function listMonthlyTaskStatusCounts(month: string): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = {
    Beklemede: 0,
    DevamEdiyor: 0,
    Incelemede: 0,
    Onaylandi: 0,
    Yayinlandi: 0,
  };
  for (const task of listProgressTasks(validMonth(month))) counts[task.status] += 1;
  return counts;
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
