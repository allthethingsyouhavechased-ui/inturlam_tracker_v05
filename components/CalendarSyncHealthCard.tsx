import Badge, { type BadgeTone } from "@/components/ui/Badge";
import { runCalendarSyncAction } from "@/lib/actions/calendar";
import { formatIsoDateTime } from "@/lib/date";
import type { CalendarSyncHealth } from "@/lib/calendar/health";

const STATUS: Record<CalendarSyncHealth["overallStatus"], { label: string; tone: BadgeTone }> = {
  unconfigured: { label: "Yapılandırılmadı", tone: "warning" },
  error: { label: "Müdahale gerekli", tone: "danger" },
  pending: { label: "Kuyruk bekliyor", tone: "warning" },
  healthy: { label: "Senkron sağlıklı", tone: "success" },
  waiting: { label: "İlk senkron bekleniyor", tone: "neutral" },
};

const SCHEDULER_LABEL: Record<CalendarSyncHealth["schedulerStatus"], string> = {
  active: "5 dk görevi aktif",
  stale: "5 dk görevi gecikmiş",
  unknown: "5 dk görevi doğrulanmadı",
};

export default function CalendarSyncHealthCard({ health }: { health: CalendarSyncHealth }) {
  const status = STATUS[health.overallStatus];
  return (
    <aside className="rounded-xl border border-border-default bg-surface px-3 py-3" aria-label="Google Calendar senkron sağlığı">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xs font-semibold text-foreground">Google Calendar senkronu</h2>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-muted">
            {SCHEDULER_LABEL[health.schedulerStatus]} · Son başarılı: {formatIsoDateTime(health.lastSuccessAt)} · Bekleyen: {health.pendingCount} · Hatalı: {health.errorCount}
          </p>
          {health.lastError && (
            <p className="mt-1 max-w-4xl truncate text-[11px] text-danger" title={health.lastError}>
              Son hata: {health.lastError}
            </p>
          )}
          {!health.configured && (
            <p className="mt-1 text-[11px] text-warning">
              Test takvimi kimlik bilgileri .env.local dosyasına eklenmeden dış senkron çalışmaz.
            </p>
          )}
        </div>
        <form action={runCalendarSyncAction}>
          <button
            type="submit"
            disabled={!health.configured}
            className="ui-press min-h-9 rounded-lg border border-border-default bg-background px-3 text-xs font-semibold text-secondary hover:bg-surface-hover hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            Şimdi senkronize et
          </button>
        </form>
      </div>
    </aside>
  );
}
