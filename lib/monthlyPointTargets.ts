import type { MonthlyProgress } from "@/lib/types";

export interface PointTargetProgress {
  month: string;
  target_points: number | null;
  earned_points: number;
  assigned_points: number;
  percent: number | null;
  remaining_points: number | null;
  extra_points: number | null;
}

export function assertTargetMonth(month: string): string {
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Geçerli bir ay seçin.");
  return month;
}

export function assertTargetPoints(value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > 100000) {
    throw new Error("Hedef puanı 1 ile 100.000 arasında tam sayı olmalı.");
  }
  return value;
}

export function calculatePointTargetProgress(progress: MonthlyProgress, target: number | null): PointTargetProgress {
  if (target !== null) assertTargetPoints(target);
  const earned = progress.weighted_earned;
  return {
    month: progress.month,
    target_points: target,
    earned_points: earned,
    assigned_points: progress.weighted_total,
    percent: target === null ? null : Number((earned / target * 100).toFixed(1)),
    remaining_points: target === null ? null : Number(Math.max(0, target - earned).toFixed(2)),
    extra_points: target === null ? null : Number(Math.max(0, earned - target).toFixed(2)),
  };
}

export function summarizePointTargets(rows: PointTargetProgress[]) {
  const configured = rows.filter(row => row.target_points !== null);
  const target = configured.reduce((sum, row) => sum + row.target_points!, 0);
  const earned = Number(configured.reduce((sum, row) => sum + row.earned_points, 0).toFixed(2));
  return {
    target_points: target,
    earned_points: earned,
    percent: target === 0 ? null : Number((earned / target * 100).toFixed(1)),
    missing_count: rows.length - configured.length,
    reached_count: configured.filter(row => row.earned_points >= row.target_points!).length,
  };
}
