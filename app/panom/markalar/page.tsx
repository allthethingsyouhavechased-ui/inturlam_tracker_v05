import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import MonthNavigator from "@/components/MonthNavigator";
import { buttonClass } from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { brandAccentStyle } from "@/lib/brandAccent";
import { TASK_STATUS_LABEL } from "@/lib/constants";
import { formatMonthLabel, monthParamISO, monthParamToDate } from "@/lib/date";
import { requirePageSession } from "@/lib/identity";
import { combineMonthlyProgress, formatPoints } from "@/lib/progress";
import { listPersonBrandAssignments } from "@/lib/repositories/brandAssignments";
import {
  listBrandMonthlyContributions,
  listBrandMonthlyProgress,
  listPersonMonthlyContributions,
} from "@/lib/repositories/progress";
import type { TaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES: TaskStatus[] = ["Beklemede", "DevamEdiyor", "Incelemede", "Onaylandi", "Yayinlandi"];

export default async function AssignedBrandsDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const me = await requirePageSession();
  const sp = await searchParams;
  const monthDate = monthParamToDate(sp.month);
  const month = monthParamISO(monthDate);
  const monthLabel = formatMonthLabel(monthDate);
  const assignments = listPersonBrandAssignments(me.id);
  const portfolioById = new Map(listBrandMonthlyProgress(month).map((brand) => [brand.brand_id, brand]));
  const personalContributions = listPersonMonthlyContributions(me.id, month);

  const brands = assignments.flatMap((assignment) => {
    const brand = portfolioById.get(assignment.brand_id);
    if (!brand) return [];
    const tasks = listBrandMonthlyContributions(assignment.brand_id, month);
    const personalTasks = personalContributions.filter((task) => task.brand_id === assignment.brand_id);
    const statusCounts = Object.fromEntries(
      STATUSES.map((status) => [status, tasks.filter((task) => task.status === status).length]),
    ) as Record<TaskStatus, number>;
    return [{ ...brand, tasks, personalTasks, statusCounts }];
  });
  const totalProgress = combineMonthlyProgress(month, brands.map((brand) => brand.progress));
  const plannedBrands = brands.filter((brand) => brand.progress.percent !== null).length;

  return (
    <div>
      <PageHeader
        eyebrow="KİŞİSEL MARKA PORTFÖYÜ"
        title="Üzerimdeki markalar"
        description={`${monthLabel} · ${me.name} adına atanmış markaların toplam ilerlemesi, durum dağılımı ve kişisel katkısı.`}
        breadcrumb={[{ label: "Panom", href: "/panom" }, { label: "Üzerimdeki markalar" }]}
        actions={<><MonthNavigator month={month} basePath="/panom/markalar" ariaLabel="Marka portföyü analiz ayı" /><Link href="/panom" className={buttonClass({ variant: "secondary" })}>Panoma dön</Link></>}
      />

      <div className="space-y-6">
      <section className="grid grid-cols-2 divide-x divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-default bg-surface lg:grid-cols-4 lg:divide-y-0">
        <div className="px-4 py-4 sm:px-5"><p className="text-[10px] font-semibold tracking-[0.08em] text-muted">TOPLAM İLERLEME</p><p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{totalProgress.percent === null ? "Plan yok" : `%${totalProgress.percent}`}</p></div>
        <div className="px-4 py-4 sm:px-5"><p className="text-[10px] font-semibold tracking-[0.08em] text-muted">ATANMIŞ MARKA</p><p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{brands.length}</p><p className="mt-0.5 text-[10px] text-muted">{plannedBrands} markada aylık plan var</p></div>
        <div className="px-4 py-4 sm:px-5"><p className="text-[10px] font-semibold tracking-[0.08em] text-muted">AYLIK GÖREV</p><p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{totalProgress.task_count}</p></div>
        <div className="px-4 py-4 sm:px-5"><p className="text-[10px] font-semibold tracking-[0.08em] text-muted">AĞIRLIKLI PUAN</p><p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{formatPoints(totalProgress.weighted_earned)}<span className="text-sm font-medium text-muted"> / {formatPoints(totalProgress.weighted_total)}</span></p></div>
      </section>

      {brands.length > 0 ? (
        <div className="space-y-4">
          {brands.map((brand) => (
            <section
              key={brand.brand_id}
              data-brand-accent
              style={brandAccentStyle(brand.brand_accent_hue)}
              className="brand-stripe overflow-hidden rounded-r-xl border border-border-default bg-surface"
            >
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <BrandLogo name={brand.brand_name} logoPath={brand.brand_logo_path} accentHue={brand.brand_accent_hue} />
                  <div className="min-w-0"><h2 className="truncate text-sm font-semibold text-foreground">{brand.brand_name}</h2><p className="mt-0.5 text-[11px] text-muted">{brand.progress.task_count} aylık görev · kişisel katkın {brand.personalTasks.length} görev</p></div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right"><p className="text-xl font-semibold tabular-nums text-foreground">{brand.progress.percent === null ? "Plan yok" : `%${brand.progress.percent}`}</p><p className="text-[10px] text-muted">Marka ilerlemesi</p></div>
                  <Link href={`/brands/${brand.brand_id}?month=${month}`} className="ui-press inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/40">Markaya git →</Link>
                </div>
              </div>
              <div className="grid sm:grid-cols-[minmax(13rem,0.8fr)_minmax(0,1.2fr)]">
                <div className="border-b border-border-subtle px-4 py-4 sm:border-b-0 sm:border-r sm:px-5">
                  <p className="text-[10px] font-semibold tracking-[0.08em] text-muted">AĞIRLIKLI İLERLEME</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-subtle"><div className="brand-accent-fill h-full rounded-full" style={{ width: `${brand.progress.percent ?? 0}%` }} /></div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted"><span>{formatPoints(brand.progress.weighted_earned)} / {formatPoints(brand.progress.weighted_total)} puan</span><span>Kişisel: {formatPoints(brand.personalTasks.reduce((sum, task) => sum + task.contribution_points, 0))} puan</span></div>
                </div>
                <div className="grid grid-cols-2 gap-px bg-border-subtle sm:grid-cols-5">
                  {STATUSES.map((status) => <div key={status} className="bg-surface px-3 py-3"><p className="truncate text-[9px] font-semibold text-muted">{TASK_STATUS_LABEL[status]}</p><p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{brand.statusCounts[status]}</p></div>)}
                </div>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <section className="rounded-xl border border-border-default bg-surface px-5 py-14 text-center"><p className="text-sm font-semibold text-secondary">Henüz marka ataman bulunmuyor.</p><p className="mt-1 text-xs text-muted">Yönetici marka atadığında ayrıntılı portföy analizin burada oluşacak.</p></section>
      )}
      </div>
    </div>
  );
}
