import Link from "next/link";
import MonthlyPointTargetCard from "@/components/MonthlyPointTargetCard";
import { getPersonPointTargetProgress } from "@/lib/repositories/monthlyPointTargets";
import EmptyState from "@/components/EmptyState";
import MonthNavigator from "@/components/MonthNavigator";
import { buttonClass } from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { brandAccentStyle } from "@/lib/brandAccent";
import { TASK_STATUS_LABEL } from "@/lib/constants";
import { formatMonthLabel, monthParamISO, monthParamToDate, shiftMonthParam } from "@/lib/date";
import { requirePageSession } from "@/lib/identity";
import { comparePeriod } from "@/lib/periodComparison";
import { formatPoints } from "@/lib/progress";
import { getPersonMonthlyProgress, listPersonMonthlyContributions } from "@/lib/repositories/progress";

export const dynamic = "force-dynamic";

export default async function ContributionPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const me = await requirePageSession();
  const sp = await searchParams;
  const monthDate = monthParamToDate(sp.month);
  const month = monthParamISO(monthDate);
  const previousMonth = shiftMonthParam(month, -1);
  const progress = getPersonMonthlyProgress(me.id, month);
  const targetProgress = getPersonPointTargetProgress(me.id, month);
  const previous = getPersonPointTargetProgress(me.id, previousMonth);
  const contributions = listPersonMonthlyContributions(me.id, month);
  const comparison = targetProgress.percent === null
    ? "Bu ay hedef tanımlanmadı"
    : comparePeriod(targetProgress.percent, previous.percent);

  return (
    <div>
      <PageHeader
        eyebrow="KİŞİSEL İLERLEME"
        title="Bu ayki katkım"
        description={`${formatMonthLabel(monthDate)} · Teslim tarihi seçilen aya düşen görevler hesaplanır; oluşturma veya tamamlanma ayı değil.`}
        breadcrumb={[{ label: "Panom", href: "/panom" }, { label: "Katkım" }]}
        actions={<><MonthNavigator month={month} basePath="/panom/katkim" ariaLabel="Katkı analiz ayı" /><Link href="/panom" className={buttonClass({ variant: "secondary" })}>Panoma dön</Link></>}
      />

      <div className="space-y-6">
      <div id="aylik-hedefim" className="scroll-mt-24">
        <MonthlyPointTargetCard progress={targetProgress} />
      </div>
      <section aria-label="Katkı özeti" className="grid gap-px overflow-hidden rounded-xl border border-border-default bg-border-subtle sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-surface p-4 sm:p-5">
          <p className="text-eyebrow text-brand-600 dark:text-brand-300">ATANAN PLANIN İLERLEMESİ</p>
          <p className="mt-1 font-display text-2xl font-semibold text-foreground">{progress.percent === null ? "Plan yok" : `%${progress.percent}`}</p>
          <p className="mt-1 text-xs text-muted">Görev durumuna göre katkı; kişisel hedeften ayrı</p>
        </div>
        <div className="bg-surface p-4 sm:p-5">
          <p className="text-eyebrow text-brand-600 dark:text-brand-300">KAZANILAN PUAN</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">{formatPoints(progress.weighted_earned)}</p>
          <p className="mt-1 text-xs tabular-nums text-muted">{formatPoints(progress.weighted_total)} toplam puan üzerinden</p>
        </div>
        <div className="bg-surface p-4 sm:p-5">
          <p className="text-eyebrow text-brand-600 dark:text-brand-300">GÖREV KAPSAMI</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">{progress.task_count}</p>
          <p className="mt-1 text-xs text-muted">Teslim ayına göre görev</p>
        </div>
        <div className="bg-surface p-4 sm:p-5">
          <p className="text-eyebrow text-brand-600 dark:text-brand-300">DÖNEM KARŞILAŞTIRMASI</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{comparison}</p>
          <p className="mt-1 text-xs text-muted">Önceki ay hedef gerçekleşmesi: {previous.percent === null ? "hedef yok" : `%${previous.percent}`}</p>
        </div>
      </section>

      {progress.percent !== null && (
        <div className="h-2 overflow-hidden rounded-md bg-surface-muted" aria-label={`Aylık ilerleme yüzde ${progress.percent}`}>
          <div className="h-full bg-brand-600" style={{ width: `${progress.percent}%` }} />
        </div>
      )}

      <section aria-labelledby="contribution-list-title">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div><h2 id="contribution-list-title" className="text-base font-semibold text-foreground">Puanı oluşturan görevler</h2><p className="mt-1 text-xs text-muted">Durum ilerledikçe görev puanının kazanılan kısmı artar.</p></div>
          <Link href={`/tasks?assignee=${encodeURIComponent(me.id)}`} className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">Tüm görevlerim</Link>
        </div>
        {contributions.length === 0 ? (
          <EmptyState title="Bu ay katkı görevi yok" description="Teslim tarihi bu aya düşen bir görev atandığında katkı hesabı burada oluşur." />
        ) : (
          <div className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-default bg-surface">
            {contributions.map((task) => (
              <article key={task.id} data-brand-accent style={brandAccentStyle(task.brand_accent_hue)} className="brand-stripe grid min-w-0 gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-4">
                <div className="min-w-0"><Link href={`/tasks/${task.id}`} className="block truncate text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-300">{task.title}</Link><Link href={`/brands/${task.brand_id}?month=${month}`} className="mt-0.5 block truncate text-xs text-muted hover:text-brand-600 dark:hover:text-brand-300">{task.brand_name}</Link></div>
                <span className="w-fit rounded-md bg-surface-muted px-2 py-1 text-[11px] font-semibold text-secondary">{TASK_STATUS_LABEL[task.status]}</span>
                <span className="text-right text-xs tabular-nums text-muted"><strong className="text-foreground">{formatPoints(task.contribution_points)}</strong> / {formatPoints(task.weight_points)} puan</span>
              </article>
            ))}
          </div>
        )}
      </section>
      </div>
    </div>
  );
}
