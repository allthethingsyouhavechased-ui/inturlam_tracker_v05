import ActionForm from "@/components/ActionForm";
import SubmitButton from "@/components/SubmitButton";
import { completeTaskRevisionAction, startTaskRevisionAction } from "@/lib/actions/tasks";
import { formatRevisionDuration, isRevisionOverTarget } from "@/lib/taskMetadata";
import { TASK_REVISION_TARGET_OPTIONS } from "@/lib/taskRevisions";
import type { TaskRevisionRound, TaskStatus } from "@/lib/types";

export default function TaskRevisionPanel({
  taskId,
  status,
  archived,
  rounds,
}: {
  taskId: string;
  status: TaskStatus;
  archived: boolean;
  rounds: TaskRevisionRound[];
}) {
  const active = rounds.find((round) => round.completed_at === null) ?? null;
  const completed = rounds.filter((round) => round.completed_at !== null);
  const totalMinutes = completed.reduce((sum, round) => sum + round.elapsed_minutes, 0);
  const cannotStartReason = archived
    ? "Arşivdeki görevi önce arşivden çıkarın."
    : status === "Yayinlandi"
      ? "Yeni revize için görevi önce yeniden açın."
      : null;

  return (
    <section className="overflow-hidden rounded-xl border border-border-default bg-surface">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border-subtle px-4 py-4 sm:px-5">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">REVİZE TAKİBİ</p>
          <h2 className="mt-1 text-sm font-semibold text-foreground">Geri bildirim turları</h2>
          <p className="mt-1 text-xs text-muted">Tur sayısı elle yazılmaz; başlangıç ve tamamlanma zamanından otomatik ölçülür.</p>
        </div>
        <div className="text-right text-xs text-muted">
          <p><strong className="text-base font-semibold tabular-nums text-foreground">{rounds.length}</strong> tur</p>
          <p>{completed.length > 0 ? `${formatRevisionDuration(totalMinutes)} tamamlanan süre` : "Henüz tamamlanan revize yok"}</p>
        </div>
      </div>

      {active ? (
        <div className="border-b border-border-subtle bg-violet-50/60 px-4 py-4 dark:bg-violet-950/20 sm:px-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-violet-800 dark:text-violet-200">R{active.round_number} aktif revize</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
                {formatRevisionDuration(active.elapsed_minutes)} / {formatRevisionDuration(active.target_minutes)} hedef
              </p>
              {active.note && <p className="mt-2 max-w-2xl whitespace-pre-wrap text-xs leading-5 text-secondary">{active.note}</p>}
              {isRevisionOverTarget(active.elapsed_minutes, active.target_minutes) && (
                <p className="mt-2 text-xs font-semibold text-danger">Hedef süre aşıldı.</p>
              )}
            </div>
            <form action={completeTaskRevisionAction.bind(null, active.id)}>
              <SubmitButton pendingLabel="Tamamlanıyor…">Revizeyi tamamla</SubmitButton>
            </form>
          </div>
        </div>
      ) : (
        <div className="border-b border-border-subtle px-4 py-4 sm:px-5">
          {cannotStartReason ? (
            <p className="text-xs text-muted">{cannotStartReason}</p>
          ) : (
            <ActionForm
              action={startTaskRevisionAction}
              successMessage="Yeni revize turu başlatıldı."
              resetOnSuccess
              className="grid gap-3 md:grid-cols-[10rem_minmax(0,1fr)_auto] md:items-end"
            >
              <input type="hidden" name="taskId" value={taskId} />
              <label className="grid gap-1.5 text-xs font-medium text-secondary">
                Hedef süre
                <select name="targetMinutes" defaultValue="480" className="min-h-11 rounded-xl border border-border-default bg-surface px-3 text-sm outline-none focus:border-brand-500">
                  {TASK_REVISION_TARGET_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-secondary">
                Revize notu <span className="font-normal text-muted">(opsiyonel)</span>
                <input name="note" maxLength={1000} placeholder="İstenen değişiklikleri kısaca yaz…" className="min-h-11 rounded-xl border border-border-default bg-surface px-3 text-sm outline-none focus:border-brand-500" />
              </label>
              <SubmitButton pendingLabel="Başlatılıyor…">Yeni revize turu</SubmitButton>
            </ActionForm>
          )}
        </div>
      )}

      <div className="px-4 py-3 sm:px-5">
        {rounds.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted">Bu görevde henüz revize turu yok.</p>
        ) : (
          <ol className="divide-y divide-border-subtle">
            {rounds.map((round) => (
              <li key={round.id} className="grid gap-1 py-3 text-xs sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center sm:gap-3">
                <span className="font-semibold text-foreground">R{round.round_number}</span>
                <span className="min-w-0 text-muted">
                  {round.note || (round.completed_at ? "Revize tamamlandı" : "Aktif revize")}
                </span>
                <span className={`font-medium tabular-nums ${isRevisionOverTarget(round.elapsed_minutes, round.target_minutes) ? "text-danger" : "text-secondary"}`}>
                  {formatRevisionDuration(round.elapsed_minutes)} / {formatRevisionDuration(round.target_minutes)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
