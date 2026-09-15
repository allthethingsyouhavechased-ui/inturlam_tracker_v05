import { getDb, plainList, plainOne } from "@/lib/db/client";
import { TASK_STATUSES } from "@/lib/constants";
import { calculateMonthlyProgress, TASK_STATUS_COEFFICIENT } from "@/lib/progress";
import type { MonthlyProgress, TaskStatus } from "@/lib/types";
import { assertMonthPeriod } from "@/lib/periodValidation";

interface ProgressTaskRow {
  id: string;
  title: string;
  status: TaskStatus;
  weight_points: number;
  brand_id: string;
  brand_name: string;
  brand_accent_hue: number;
}

export interface TaskContribution extends ProgressTaskRow {
  contribution_points: number;
}

export interface BrandMonthlyProgressRow {
  brand_id: string;
  brand_name: string;
  brand_logo_path: string | null;
  brand_accent_hue: number;
  progress: MonthlyProgress;
}

function validMonth(month: string): string {
  return assertMonthPeriod(month);
}

// Puanlanabilir durumlar TEK kaynaktan: TASK_STATUS_COEFFICIENT'in anahtarları.
// v03'te tasks.status "IptalEdildi" de olabiliyordu (v03 lib/types.ts'te TaskStatus
// altı değerliydi), v05'te bu değer yalnızca ContentStatus'ta kaldı. v03 verisi
// taşındığında o satırlar buraya sızıyor ve TASK_STATUS_COEFFICIENT[status]
// undefined döndüğü için weight_points * undefined = NaN bütün toplamı NaN yapıyordu
// (weighted_total saf toplam olduğu için sağlam kalıyor, sadece pay NaN oluyordu).
// İptal edilmiş iş aylık plana ne payda ne paydada girmeli — bu yüzden eleniyor.
const SCORABLE_STATUSES = Object.keys(TASK_STATUS_COEFFICIENT);
const SCORABLE_STATUS_PLACEHOLDERS = SCORABLE_STATUSES.map(() => "?").join(", ");

function listProgressTasks(month: string, whereSql = "", params: string[] = []): ProgressTaskRow[] {
  return plainList<ProgressTaskRow>(
    getDb().prepare(
      `SELECT t.id, t.title, t.status, t.weight_points, b.id AS brand_id, b.name AS brand_name, b.accent_hue AS brand_accent_hue
         FROM tasks t
         JOIN content_items ci ON ci.id = t.content_item_id
         JOIN brands b ON b.id = ci.brand_id
        WHERE substr(t.due_date, 1, 7) = ?
          AND t.status IN (${SCORABLE_STATUS_PLACEHOLDERS}) ${whereSql}
        ORDER BY b.sort_order, b.name, t.due_date, t.created_at`,
    ).all(validMonth(month), ...SCORABLE_STATUSES, ...params),
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
    brand_accent_hue: number;
  }>(
    getDb().prepare(
      `SELECT id AS brand_id, name AS brand_name, logo_path AS brand_logo_path, accent_hue AS brand_accent_hue
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
  // Sabit liste yerine TASK_STATUSES'tan türetiliyor: yeni bir durum eklenince
  // burada sessizce eksik kalmasın (eksik anahtar `counts[status] += 1` ile
  // NaN üretirdi).
  const counts = Object.fromEntries(
    TASK_STATUSES.map((status) => [status, 0]),
  ) as Record<TaskStatus, number>;
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

// Header her istekte çalıştığı için görev satırlarını yüklemez; aynı due_date
// kapsamını tek aggregate sorgusunda hesaplar.
export function getPersonMonthlyProgressSummary(personId: string, month: string): MonthlyProgress {
  const valid = validMonth(month);
  const row = plainOne<{ weighted_total: number; weighted_earned: number; task_count: number }>(
    getDb().prepare(
      `SELECT
         COALESCE(SUM(t.weight_points), 0) AS weighted_total,
         COALESCE(SUM(t.weight_points * CASE t.status
           ${Object.entries(TASK_STATUS_COEFFICIENT).map(([status, coefficient]) => `WHEN '${status}' THEN ${coefficient}`).join(" ")}
           ELSE 0 END), 0) AS weighted_earned,
         COUNT(*) AS task_count
       FROM tasks t
       WHERE t.assignee_id = ? AND substr(t.due_date, 1, 7) = ?
         AND t.status IN (${SCORABLE_STATUS_PLACEHOLDERS})`,
    ).get(personId, valid, ...SCORABLE_STATUSES),
  );
  const total = Number(row?.weighted_total ?? 0);
  const earned = Number(Number(row?.weighted_earned ?? 0).toFixed(2));
  return {
    month: valid,
    weighted_total: total,
    weighted_earned: earned,
    percent: total === 0 ? null : Number(((earned / total) * 100).toFixed(1)),
    task_count: Number(row?.task_count ?? 0),
  };
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
