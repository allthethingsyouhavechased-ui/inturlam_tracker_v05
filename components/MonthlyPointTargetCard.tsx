import { formatPoints } from "@/lib/progress";
import type { PointTargetProgress } from "@/lib/monthlyPointTargets";

export default function MonthlyPointTargetCard({ progress, title = "Aylık hedefim", compact = false }: {
  progress: PointTargetProgress; title?: string; compact?: boolean;
}) {
  const { target_points: target, earned_points: earned, percent, remaining_points: remaining, extra_points: extra } = progress;
  return (
    <section aria-label={title} className={compact ? "min-w-0" : "mb-5 min-w-0 rounded-xl border border-border-default bg-surface p-4 sm:p-5"}>
      <p className="text-eyebrow text-brand-600 dark:text-brand-300">{title}</p>
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-xl font-semibold tabular-nums text-foreground">
          {formatPoints(earned)} <span className="text-sm font-medium text-muted">/ {target === null ? "—" : formatPoints(target)} puan</span>
        </p>
        {percent !== null && <p className="text-xl font-semibold tabular-nums text-brand-600 dark:text-brand-300">%{percent}</p>}
      </div>
      {percent === null ? (
        <p className="mt-2 text-xs text-muted">Hedef tanımlanmadı. Yöneticiniz bu ayın hedefini belirleyebilir.</p>
      ) : (
        <>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted" role="progressbar"
            aria-label={title} aria-valuemin={0} aria-valuemax={Math.max(100, percent)} aria-valuenow={percent}
            aria-valuetext={`${formatPoints(target!)} puan hedefin ${formatPoints(earned)} puanı kazanıldı, yüzde ${percent}`}>
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
          </div>
          <p className="mt-2 text-xs font-medium text-secondary">
            {extra! > 0 ? `Hedefin ${formatPoints(extra!)} puan üzerinde` : remaining === 0 ? "Hedef tamamlandı" : `${formatPoints(remaining!)} puan kaldı`}
          </p>
        </>
      )}
      {!compact && <p className="mt-2 text-xs text-muted">{progress.month} · Atanan iş: {formatPoints(progress.assigned_points)} puan. Katkı, iç teslim ayına ve görev durumuna göre hesaplanır.</p>}
    </section>
  );
}
