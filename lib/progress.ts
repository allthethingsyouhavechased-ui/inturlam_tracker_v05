import type { MonthlyProgress, TaskStatus } from "@/lib/types";

export const TASK_STATUS_COEFFICIENT: Readonly<Record<TaskStatus, number>> = {
  Beklemede: 0,
  DevamEdiyor: 0.25,
  Incelemede: 0.6,
  Onaylandi: 0.9,
  Yayinlandi: 1,
};

export interface WeightedTask {
  status: TaskStatus;
  weight_points: number;
}

export function calculateMonthlyProgress(month: string, tasks: WeightedTask[]): MonthlyProgress {
  const weightedTotal = tasks.reduce((sum, task) => sum + task.weight_points, 0);
  const weightedEarned = tasks.reduce(
    (sum, task) => sum + task.weight_points * TASK_STATUS_COEFFICIENT[task.status],
    0,
  );
  return {
    month,
    weighted_total: weightedTotal,
    weighted_earned: Number(weightedEarned.toFixed(2)),
    percent: weightedTotal === 0 ? null : Number(((weightedEarned / weightedTotal) * 100).toFixed(1)),
    task_count: tasks.length,
  };
}

export function combineMonthlyProgress(
  month: string,
  progresses: MonthlyProgress[],
): MonthlyProgress {
  const weightedTotal = progresses.reduce((sum, progress) => sum + progress.weighted_total, 0);
  const weightedEarned = Number(
    progresses.reduce((sum, progress) => sum + progress.weighted_earned, 0).toFixed(2),
  );
  return {
    month,
    weighted_total: weightedTotal,
    weighted_earned: weightedEarned,
    percent: weightedTotal === 0 ? null : Number(((weightedEarned / weightedTotal) * 100).toFixed(1)),
    task_count: progresses.reduce((sum, progress) => sum + progress.task_count, 0),
  };
}

export function assertWeightPoints(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error("Görev ağırlığı 1 ile 100 arasında tam sayı olmalı.");
  }
  return value;
}

export function resolveTaskCreationWeight(value: unknown, canSetWeight: boolean): number {
  const raw = value === null || value === undefined || String(value).trim() === ""
    ? 1
    : Number(value);
  const weight = assertWeightPoints(raw);
  if (!canSetWeight && weight !== 1) {
    throw new Error("Görev ağırlığını yalnızca yöneticiler belirleyebilir.");
  }
  return weight;
}
