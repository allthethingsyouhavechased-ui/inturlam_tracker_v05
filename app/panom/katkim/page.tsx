import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import { TASK_STATUS_BADGE, TASK_STATUS_LABEL } from "@/lib/constants";
import { formatMonthLabel, monthParamToDate, todayISO } from "@/lib/date";
import { requirePageSession } from "@/lib/identity";
import { calculateMonthlyProgress } from "@/lib/progress";
import { getPersonMonthlyProgress, listPersonMonthlyContributions } from "@/lib/repositories/progress";
import type { TaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES: TaskStatus[] = ["Beklemede", "DevamEdiyor", "Incelemede", "Onaylandi", "Yayinlandi"];

function points(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export default async function ContributionDetailPage() {
  const me = await requirePageSession();
  const month = todayISO().slice(0, 7);
  const monthLabel = formatMonthLabel(monthParamToDate(month));
  const progress = getPersonMonthlyProgress(me.id, month);
  const contributions = listPersonMonthlyContributions(me.id, month);
  const statusCounts = new Map<TaskStatus, number>();
  const byBrand = new Map<string, typeof contributions>();

  for (const task of contributions) {
    statusCounts.set(task.status, (statusCounts.get(task.status) ?? 0) + 1);
    byBrand.set(task.brand_id, [...(byBrand.get(task.brand_id) ?? []), task]);
  }

  const brandRows = [...byBrand.entries()].map(([brandId, tasks]) => ({
    brandId,
    brandName: tasks[0].brand_name,
    progress: calculateMonthlyProgress(month, tasks),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="KİŞİSEL PERFORMANS"
        title="Bu ayki katkım"
        description={`${monthLabel} · ${me.name} için görev ağırlıkları ve durum katsayılarıyla hesaplanan ayrıntılı görünüm.`}
        breadcrumb={[{ label: "Panom", href: "/panom" }, { label: "Bu ayki katkım" }]}
        actions={<Link href="/panom" className="ui-press inline-flex min-h-10 items-center rounded-[10px] border border-border-default bg-surface px-3 text-xs font-semibold text-secondary hover:bg-surface-hover">Panoma dön</Link>}
      />

      <section className="grid grid-cols-2 divide-x divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-default bg-surface lg:grid-cols-4 lg:divide-y-0">
        <div className="px-4 py-4 sm:px-5"><p className="text-[10px] font-semibold tracking-[0.08em] text-muted">AYLIK İLERLEME</p><p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{progress.percent === null ? "Plan yok" : `%${progress.percent}`}</p></div>
        <div className="px-4 py-4 sm:px-5"><p className="text-[10px] font-semibold tracking-[0.08em] text-muted">GÖREV</p><p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{progress.task_count}</p></div>
        <div className="px-4 py-4 sm:px-5"><p className="text-[10px] font-semibold tracking-[0.08em] text-muted">KAZANILAN PUAN</p><p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{points(progress.weighted_earned)}</p></div>
        <div className="px-4 py-4 sm:px-5"><p className="text-[10px] font-semibold tracking-[0.08em] text-muted">TOPLAM AĞIRLIK</p><p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{points(progress.weighted_total)}</p></div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(18rem,0.7fr)_minmax(0,1.3fr)]">
        <section className="overflow-hidden rounded-xl border border-border-default bg-surface">
          <div className="border-b border-border-subtle px-4 py-3.5 sm:px-5"><h2 className="text-sm font-semibold text-foreground">Marka dağılımı</h2><p className="mt-0.5 text-xs text-muted">Yalnızca sana atanmış ve teslim tarihi bu ayda olan görevler.</p></div>
          {brandRows.length > 0 ? <div className="divide-y divide-border-subtle">{brandRows.map((brand) => <Link key={brand.brandId} href={`/brands/${brand.brandId}`} className="group block px-4 py-3 hover:bg-surface-hover sm:px-5"><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-300">{brand.brandName}</span><span className="shrink-0 tabular-nums text-muted">{brand.progress.percent === null ? "Plan yok" : `%${brand.progress.percent}`}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-subtle"><div className="h-full rounded-full bg-brand-600" style={{ width: `${brand.progress.percent ?? 0}%` }} /></div><p className="mt-1.5 text-[10px] text-muted">{brand.progress.task_count} görev · {points(brand.progress.weighted_earned)}/{points(brand.progress.weighted_total)} puan</p></Link>)}</div> : <p className="px-5 py-8 text-center text-sm text-muted">Bu ay marka katkısı oluşmadı.</p>}
        </section>

        <section className="overflow-hidden rounded-xl border border-border-default bg-surface">
          <div className="border-b border-border-subtle px-4 py-3.5 sm:px-5"><h2 className="text-sm font-semibold text-foreground">Durum analizi</h2><p className="mt-0.5 text-xs text-muted">Görevlerin üretim akışında hangi aşamada olduğu.</p></div>
          <div className="grid grid-cols-2 gap-px bg-border-subtle sm:grid-cols-5">{STATUSES.map((status) => <div key={status} className="bg-surface px-3 py-3"><p className="text-[10px] font-semibold text-muted">{TASK_STATUS_LABEL[status]}</p><p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{statusCounts.get(status) ?? 0}</p></div>)}</div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-border-default bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3.5 sm:px-5"><div><h2 className="text-sm font-semibold text-foreground">Katkı dökümü</h2><p className="mt-0.5 text-xs text-muted">Her görevin toplam içindeki gerçek puan karşılığı.</p></div><span className="text-xs font-semibold tabular-nums text-muted">{contributions.length} görev</span></div>
        {contributions.length > 0 ? <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-surface-subtle text-[10px] uppercase tracking-wide text-muted"><tr><th className="px-4 py-2.5 font-semibold sm:px-5">Görev</th><th className="px-3 py-2.5 font-semibold">Durum</th><th className="px-3 py-2.5 text-right font-semibold">Ağırlık</th><th className="px-4 py-2.5 text-right font-semibold sm:px-5">Katkı</th></tr></thead><tbody className="divide-y divide-border-subtle">{contributions.map((task) => <tr key={task.id} className="hover:bg-surface-hover"><td className="px-4 py-3 sm:px-5"><Link href={`/tasks/${task.id}`} className="font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-300">{task.title}</Link><p className="mt-0.5 text-[10px] text-muted">{task.brand_name}</p></td><td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${TASK_STATUS_BADGE[task.status]}`}>{TASK_STATUS_LABEL[task.status]}</span></td><td className="px-3 py-3 text-right tabular-nums text-secondary">{task.weight_points}</td><td className="px-4 py-3 text-right font-semibold tabular-nums text-foreground sm:px-5">{points(task.contribution_points)}</td></tr>)}</tbody></table></div> : <p className="px-5 py-12 text-center text-sm text-muted">Bu ay teslim tarihli görevin bulunmuyor.</p>}
      </section>
    </div>
  );
}
