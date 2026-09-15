import WorkLogPanel from "@/components/WorkLogPanel";
import WorkCorrectionQueue from "@/components/WorkCorrectionQueue";
import PageHeader from "@/components/ui/PageHeader";
import { requirePageSession } from "@/lib/identity";
import { formatMinutes, serverNow } from "@/lib/worklog";
import {
  getOpenWorkSession,
  listTeamWorkSummary,
  listWorkCorrections,
  listWorkSessions,
  workStateFor,
} from "@/lib/repositories/worklog";

export const dynamic = "force-dynamic";

export default async function WorkLogPage() {
  const me = await requirePageSession();
  const { ms: now, istanbulDay: today } = serverNow();
  const open = getOpenWorkSession(me.id, now);
  const sessions = listWorkSessions(me.id, 30, now);
  const state = workStateFor(open);
  // Yönetici özeti: BORDRO ya da performans puanı değil, yalnız görünürlük.
  const teamSummary = me.is_manager === 1 ? listTeamWorkSummary(today, today, now) : [];
  const pendingCorrections = me.is_manager === 1 ? listWorkCorrections("Beklemede") : [];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="GÜNLÜK KAYIT"
        title="Mesai"
        description="Kendi günlük çalışma kaydın. Sunucu zamanı esastır; tarayıcıdaki sayaç yalnızca gösterimdir. Bu ekran bordro, maaş veya otomatik performans puanı hesaplamaz."
      />

      <WorkLogPanel
        state={state}
        open={open}
        sessions={sessions}
        serverNowMinutes={open?.net_minutes ?? 0}
      />

      {me.is_manager === 1 && (
        <>
          <section className="overflow-hidden rounded-xl border border-border-default bg-surface">
            <div className="border-b border-border-subtle px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Ekip özeti · {today}</h2>
              <p className="mt-1 text-xs text-muted">
                Bugünün net süreleri. Mesai süresi puana çevrilmez.
              </p>
            </div>
            <div className="divide-y divide-border-subtle">
              {teamSummary.map((row) => (
                <div key={row.person_id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="text-sm font-medium text-foreground">{row.person_name}</span>
                  <span className="flex items-center gap-3 text-xs text-secondary">
                    {row.open_session && <span className="text-success">açık kayıt</span>}
                    <span className="tabular-nums">{formatMinutes(row.net_minutes)}</span>
                  </span>
                </div>
              ))}
              {teamSummary.length === 0 && (
                <p className="p-6 text-center text-sm text-muted">Bugün için kayıt yok.</p>
              )}
            </div>
          </section>

          <WorkCorrectionQueue corrections={pendingCorrections} />
        </>
      )}
    </div>
  );
}
