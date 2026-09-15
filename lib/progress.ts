import type { MonthlyProgress, TaskDifficulty, TaskStatus } from "@/lib/types";

// OPERASYONEL İLERLEME katsayıları — KAZANILMIŞ PUAN DEĞİLDİR. Kazanılmış
// puan paket onayına bağlı ve bağımsız hesaplanıyor (lib/points/*); bu tablo
// yalnızca "iş ne kadar ilerledi" göstergesini besler.
// Revizede, işin İncelemede'ye gelmiş hâlinden geri düştüğü için Devam
// Ediyor ile İncelemede arasında konumlanıyor.
export const TASK_STATUS_COEFFICIENT: Readonly<Record<TaskStatus, number>> = {
  Beklemede: 0,
  DevamEdiyor: 0.25,
  Incelemede: 0.6,
  Revizede: 0.4,
  Onaylandi: 0.9,
  MusteriIncelemede: 0.93,
  MusteriOnayladi: 0.97,
  Yayinlandi: 1,
  // Eski v02 "iptal edildi": iş hiç tamamlanmadı, ilerlemeye katkısı yok.
  IptalEdildi: 0,
};

export const DIFFICULTY_DEFAULT_WEIGHT: Readonly<Record<TaskDifficulty, number>> = {
  Kolay: 1,
  Orta: 2,
  Zor: 3,
  Ozel: 5,
};

export function formatPoints(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

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

export function resolveTaskCreationWeight(
  value: unknown,
  canSetWeight: boolean,
  difficulty: TaskDifficulty,
): number {
  const blank = value === null || value === undefined || String(value).trim() === "";
  if (blank) return DIFFICULTY_DEFAULT_WEIGHT[difficulty];
  if (!canSetWeight) {
    throw new Error("Görev ağırlığını yalnızca yöneticiler belirleyebilir.");
  }
  const raw = Number(value);
  const weight = assertWeightPoints(raw);
  return weight;
}
