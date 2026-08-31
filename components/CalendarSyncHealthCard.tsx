import Badge, { type BadgeTone } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { runCalendarSyncAction } from "@/lib/actions/calendar";
import { formatIsoDateTime } from "@/lib/date";
import type { CalendarSyncHealth } from "@/lib/calendar/health";

const STATUS: Record<CalendarSyncHealth["overallStatus"], { label: string; tone: BadgeTone }> = {
  unconfigured: { label: "Yapılandırılmadı", tone: "warning" },
  error: { label: "Müdahale gerekli", tone: "danger" },
  pending: { label: "Kuyruk bekliyor", tone: "warning" },
  healthy: { label: "Sağlıklı", tone: "success" },
  waiting: { label: "İlk senkron bekleniyor", tone: "neutral" },
};

const SCHEDULER_LABEL: Record<CalendarSyncHealth["schedulerStatus"], string> = {
  active: "5 dk görevi aktif",
  stale: "5 dk görevi gecikmiş",
  unknown: "5 dk görevi doğrulanmadı",
};

/**
 * Takvim sayfasının üstünde duran senkron şeridi.
 *
 * Sayaçlar (bekleyen/hatalı/zamanlayıcı durumu) yalnızca DURUM SAĞLIKLI DEĞİLKEN
 * yazılır; her şey yolundayken tek satır kalır ve takvime yer bırakır. Sağlıklı
 * hâlde de kaybolmaz, çünkü "senkron çalışıyor mu" sorusunun cevabı görünür
 * olmalı — sadece sessizleşir. Tam döküm her hâlde `title` içinde duruyor.
 */
export default function CalendarSyncHealthCard({ health }: { health: CalendarSyncHealth }) {
  const status = STATUS[health.overallStatus];
  const healthy = health.overallStatus === "healthy";
  const details = `${SCHEDULER_LABEL[health.schedulerStatus]} · Son başarılı: ${formatIsoDateTime(health.lastSuccessAt)} · Bekleyen: ${health.pendingCount} · Hatalı: ${health.errorCount}`;

  return (
    <aside
      className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-lg border border-border-subtle bg-surface-muted px-3 py-1.5"
      aria-label="Google Calendar senkron sağlığı"
      title={details}
    >
      <span className="text-[11px] font-semibold text-muted">Google senkronu</span>
      <Badge tone={status.tone}>{status.label}</Badge>

      {healthy ? (
        <span className="text-[11px] tabular-nums text-muted">{formatIsoDateTime(health.lastSuccessAt)}</span>
      ) : (
        <span className="text-[11px] text-muted">{details}</span>
      )}

      {health.lastError && (
        <span className="min-w-0 truncate text-[11px] text-danger" title={health.lastError}>
          {health.lastError}
        </span>
      )}

      {!health.configured && (
        <span className="text-[11px] text-warning">.env.local içinde Google bilgileri eksik.</span>
      )}

      <form action={runCalendarSyncAction} className="ml-auto">
        <button
          type="submit"
          disabled={!health.configured}
          className={buttonClass({ variant: "secondary", size: "sm", className: "text-[11px] disabled:cursor-not-allowed disabled:opacity-40" })}
        >
          Senkronize et
        </button>
      </form>
    </aside>
  );
}
