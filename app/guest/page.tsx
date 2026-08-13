import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { TASK_STATUS_LABEL } from "@/lib/constants";
import { todayISO } from "@/lib/date";
import { requireGuestSession } from "@/lib/identity";
import { listGuestTasks } from "@/lib/repositories/guestTasks";
import { getBrandMonthlyProgress } from "@/lib/repositories/progress";

export const dynamic = "force-dynamic";

export default async function GuestDashboardPage() {
  const actor = await requireGuestSession();
  const tasks = listGuestTasks(actor.brand.id, actor.account_id);
  const progress = getBrandMonthlyProgress(actor.brand.id, todayISO().slice(0, 7));
  const counts = new Map<string, number>();
  tasks.forEach((task) => counts.set(task.status, (counts.get(task.status) ?? 0) + 1));
  return (
    <div>
      <PageHeader eyebrow="MARKA PORTALI" title={actor.brand.name} description="Markanın ekipçe planlanan aylık ilerlemesi ve bu guest hesabından açılan görevler." />
      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-xl border border-border-default bg-surface p-5 md:col-span-2"><p className="text-xs font-semibold tracking-wide text-muted">MARKANIN TÜM PLANLANMIŞ İŞLERİ</p><p className="mt-3 text-4xl font-semibold tracking-tight text-foreground">{progress.percent === null ? "Bu ay plan yok" : `%${progress.percent}`}</p>{progress.percent !== null && <><div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-subtle"><div className="h-full rounded-full bg-brand-600" style={{ width: `${progress.percent}%` }} /></div><p className="mt-2 text-xs text-muted">Ekip ve guest kaynaklı {progress.task_count} planlanmış görev</p></>}</section>
        <section className="rounded-xl border border-border-default bg-surface p-5"><p className="text-xs font-semibold tracking-wide text-muted">BU HESAPTAN AÇILAN GÖREVLER</p><p className="mt-3 text-3xl font-semibold text-foreground">{tasks.length}</p><Link href="/guest/tasks" className="mt-4 inline-flex text-sm font-semibold text-brand-600">Tümünü aç →</Link></section>
      </div>
      <section className="mt-5" aria-labelledby="guest-task-status-title">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div><h2 id="guest-task-status-title" className="text-sm font-semibold text-foreground">Bu hesabın görev durumları</h2><p className="mt-0.5 text-xs text-muted">Bu sayaçlar yalnızca sizin açtığınız görevleri gösterir; üstteki marka ilerlemesiyle aynı kapsam değildir.</p></div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{(["Beklemede", "DevamEdiyor", "Incelemede", "Onaylandi", "Yayinlandi"] as const).map((status) => <div key={status} className="rounded-xl border border-border-default bg-surface px-3 py-3"><p className="text-[11px] text-muted">{TASK_STATUS_LABEL[status]}</p><p className="mt-1 text-xl font-semibold text-foreground">{counts.get(status) ?? 0}</p></div>)}</div>
      </section>
      <section className="mt-5 rounded-xl border border-border-default bg-surface"><div className="border-b border-border-subtle px-4 py-3"><h2 className="text-sm font-semibold text-foreground">Son görevler</h2></div><div className="divide-y divide-border-subtle">{tasks.slice(0, 6).map((task) => <Link key={task.id} href={`/guest/tasks/${task.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-hover"><span className="min-w-0 truncate text-sm font-medium text-foreground">{task.title}</span><span className="shrink-0 text-xs text-muted">{TASK_STATUS_LABEL[task.status]}</span></Link>)}{tasks.length === 0 && <p className="p-5 text-sm text-muted">Henüz görev yok.</p>}</div></section>
    </div>
  );
}
