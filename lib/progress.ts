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

export function assertWeightPoints(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error("Görev ağırlığı 1 ile 100 arasında tam sayı olmalı.");
  }
  return value;
}
