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
 * Takvim sayfası başlığının EYLEM alanında duran senkron göstergesi.
 *
 * Kendi kutusu/kenarlığı YOK: PageHeader eylemleri zaten yatay bir sıraya
 * diziyor, buraya ikinci bir yüzey koymak başlık satırında kutu içinde kutu
 * görüntüsü veriyordu. Eskiden takvimin üstünde tam genişlik bir şeritti ve
 * ızgaradan yer çalıyordu.
 *
 * Sayaçlar (bekleyen/hatalı/zamanlayıcı) yalnızca durum sağlıklı DEĞİLKEN
 * yazılır; sağlıklı hâlde rozet + son senkron zamanı kalır. Gösterge sağlıklıyken
 * de kaybolmaz — "senkron çalışıyor mu" sorusunun cevabı görünür olmalı, sadece
 * yer kaplamamalı. Tam döküm her hâlde `title` içinde.
 */
export default function CalendarSyncHealthCard({ health }: { health: CalendarSyncHealth }) {
  const status = STATUS[health.overallStatus];
  const healthy = health.overallStatus === "healthy";
  const details = `${SCHEDULER_LABEL[health.schedulerStatus]} · Son başarılı: ${formatIsoDateTime(health.lastSuccessAt)} · Bekleyen: ${health.pendingCount} · Hatalı: ${health.errorCount}`;

  return (
    <div
      role="group"
      aria-label="Google Calendar senkron sağlığı"
      title={details}
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1"
    >
      <span className="text-[11px] font-semibold text-muted">Google senkronu</span>
      <Badge tone={status.tone}>{status.label}</Badge>

      {healthy ? (
        <span className="text-[11px] tabular-nums text-muted">{formatIsoDateTime(health.lastSuccessAt)}</span>
      ) : (
        <span className="text-[11px] text-muted">{details}</span>
      )}

      {health.lastError && (
        <span className="min-w-0 max-w-xs truncate text-[11px] text-danger" title={health.lastError}>
          {health.lastError}
        </span>
      )}

      {!health.configured && (
        <span className="text-[11px] text-warning">.env.local içinde Google bilgileri eksik.</span>
      )}

      <form action={runCalendarSyncAction}>
        <button
          type="submit"
          disabled={!health.configured}
          className={buttonClass({ variant: "secondary", size: "sm", className: "text-[11px] disabled:cursor-not-allowed disabled:opacity-40" })}
        >
          Senkronize et
        </button>
      </form>
    </div>
  );
}
