import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import Icon from "@/components/ui/Icon";
import { TASK_STATUS_LABEL } from "@/lib/constants";
import type { BrandMonthlyProgressRow } from "@/lib/repositories/progress";
import type { MonthlyProgress, TaskStatus } from "@/lib/types";

export interface PersonalBrandProgressRow extends BrandMonthlyProgressRow {
  personal_task_count: number;
  personal_points: number;
}

function ProgressTrack({ progress }: { progress: MonthlyProgress }) {
  return progress.percent === null ? (
    <div className="mt-2 h-1.5 rounded-full bg-surface-subtle" />
  ) : (
    <div
      className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-subtle"
      role="progressbar"
      aria-label={`Aylık ilerleme yüzde ${progress.percent}`}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress.percent}
    >
      <div className="h-full rounded-full bg-brand-600" style={{ width: `${progress.percent}%` }} />
    </div>
  );
}

function Percent({ progress }: { progress: MonthlyProgress }) {
  return (
    <span className="shrink-0 text-xs font-semibold tabular-nums text-secondary">
      {progress.percent === null ? "Plan yok" : `%${progress.percent}`}
    </span>
  );
}

export default function HomeBrandProgress({
  month,
  personalBrands,
  assignedBrandsProgress,
  portfolioBrands,
  portfolioProgress,
  portfolioStatusCounts,
  personalProgress,
}: {
  month: string;
  personalBrands: PersonalBrandProgressRow[];
  assignedBrandsProgress: MonthlyProgress;
  portfolioBrands: BrandMonthlyProgressRow[];
  portfolioProgress: MonthlyProgress;
  portfolioStatusCounts: Record<TaskStatus, number>;
  personalProgress: MonthlyProgress;
}) {
  const plannedBrandCount = portfolioBrands.filter((brand) => brand.progress.percent !== null).length;
  const statuses: TaskStatus[] = ["Beklemede", "DevamEdiyor", "Incelemede", "Onaylandi", "Yayinlandi"];

  return (
    <div className="space-y-5">
      <section aria-label="Aylık analiz özeti" className="grid grid-cols-2 divide-x divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-default bg-surface lg:grid-cols-4 lg:divide-y-0">
        <div className="px-4 py-4 sm:px-5"><p className="text-[10px] font-semibold tracking-[0.08em] text-muted">BENİM AYLIK İLERLEMEM</p><p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{personalProgress.percent === null ? "Plan yok" : `%${personalProgress.percent}`}</p><Link href={`/panom/katkim?month=${month}`} className="mt-1 inline-flex text-[10px] font-semibold text-brand-600 hover:underline">Katkı dökümünü aç</Link></div>
        <div className="px-4 py-4 sm:px-5"><p className="text-[10px] font-semibold tracking-[0.08em] text-muted">ÜZERİMDEKİ MARKALAR</p><p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{assignedBrandsProgress.percent === null ? "Plan yok" : `%${assignedBrandsProgress.percent}`}</p><Link href={`/panom/markalar?month=${month}`} className="mt-1 inline-flex text-[10px] font-semibold text-brand-600 hover:underline">Marka analizini aç</Link></div>
        <div className="px-4 py-4 sm:px-5"><p className="text-[10px] font-semibold tracking-[0.08em] text-muted">PORTFÖY İLERLEMESİ</p><p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{portfolioProgress.percent === null ? "Plan yok" : `%${portfolioProgress.percent}`}</p><p className="mt-1 text-[10px] text-muted">{portfolioProgress.task_count} planlı görev</p></div>
        <div className="px-4 py-4 sm:px-5"><p className="text-[10px] font-semibold tracking-[0.08em] text-muted">PLANLI MARKA</p><p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-foreground">{plannedBrandCount}<span className="text-sm font-medium text-muted"> / {portfolioBrands.length}</span></p><p className="mt-1 text-[10px] text-muted">Bu ay işi tanımlı marka</p></div>
      </section>

      <section aria-labelledby="monthly-flow-title" className="grid overflow-hidden rounded-xl border border-border-default bg-surface sm:grid-cols-2 xl:grid-cols-[minmax(15rem,1.25fr)_repeat(5,minmax(7rem,0.75fr))]">
        <div className="border-b border-border-subtle px-4 py-3.5 sm:col-span-2 sm:px-5 xl:col-span-1 xl:border-b-0 xl:border-r">
          <p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">AYLIK ÜRETİM AKIŞI</p>
          <h2 id="monthly-flow-title" className="mt-1 text-sm font-semibold text-foreground">{portfolioProgress.task_count} planlı görev</h2>
          <p className="mt-0.5 text-[11px] text-muted">Tüm markaların ağırlıklı durum dağılımı.</p>
        </div>
        {statuses.map((status) => (
          <div key={status} className="border-b border-border-subtle px-4 py-3 last:border-b-0 odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:odd:border-r xl:last:border-r-0">
            <p className="text-[10px] font-semibold text-muted">{TASK_STATUS_LABEL[status]}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{portfolioStatusCounts[status]}</p>
          </div>
        ))}
      </section>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(20rem,0.8fr)_minmax(0,1.2fr)]">
      <section className="min-w-0 overflow-hidden rounded-xl border border-border-default bg-surface">
        <div className="flex items-end justify-between gap-3 border-b border-border-subtle px-4 py-4 sm:px-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">KİŞİSEL MARKA GÖRÜNÜMÜ</p>
            <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-foreground">Bana atanan markalar</h2>
            <p className="mt-1 text-[11px] text-muted">Markanın genel aylık ilerlemesi ve bu ay üstlendiğin ağırlıklı katkı.</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl font-semibold tracking-tight text-foreground">{assignedBrandsProgress.percent === null ? "—" : `%${assignedBrandsProgress.percent}`}</p>
            <p className="text-[10px] font-medium text-muted">Atanmış markalar toplamı</p>
          </div>
        </div>
        {personalBrands.length > 0 ? (
          <div className="divide-y divide-border-subtle">
            {personalBrands.map((brand) => (
              <Link key={brand.brand_id} href={`/brands/${brand.brand_id}?month=${month}`} className="group block px-4 py-3.5 hover:bg-surface-hover sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <BrandLogo name={brand.brand_name} logoPath={brand.brand_logo_path} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-[13px] font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-300">{brand.brand_name}</span>
                      <Percent progress={brand.progress} />
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted">
                      {brand.progress.task_count} aylık görev · senin katkın {brand.personal_task_count} görev / {brand.personal_points} puan
                    </p>
                    <ProgressTrack progress={brand.progress} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-4 py-10 text-center sm:px-5">
            <p className="text-sm font-medium text-secondary">Henüz marka ataman yok.</p>
            <p className="mt-1 text-xs text-muted">Yönetici marka atadığında kişisel analiz burada oluşacak.</p>
          </div>
        )}
      </section>

      <section className="min-w-0 overflow-hidden rounded-xl border border-border-default bg-surface">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border-subtle px-4 py-4 sm:px-5">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">PORTFÖY AYLIK İLERLEME</p>
            <h2 className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-foreground">Tüm markalar</h2>
            <p className="mt-1 text-[11px] text-muted">{plannedBrandCount} markada bu ay plan var · {portfolioBrands.length - plannedBrandCount} markada plan yok.</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tracking-tight text-foreground">{portfolioProgress.percent === null ? "—" : `%${portfolioProgress.percent}`}</p>
            <p className="text-[10px] font-medium text-muted">Ağırlıklı portföy toplamı</p>
          </div>
        </div>
        <div className="grid max-h-[34rem] overflow-y-auto sm:grid-cols-2">
          {portfolioBrands.map((brand, index) => (
            <Link
              key={brand.brand_id}
              href={`/brands/${brand.brand_id}?month=${month}`}
              className={`group min-w-0 px-4 py-3 hover:bg-surface-hover sm:px-5 ${index > 0 ? "border-t border-border-subtle" : ""} sm:[&:nth-child(2)]:border-t-0 sm:[&:nth-child(even)]:border-l`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <BrandLogo name={brand.brand_name} logoPath={brand.brand_logo_path} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-300">{brand.brand_name}</span>
                    <Percent progress={brand.progress} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-muted">{brand.progress.task_count} görev</span>
                    <Icon name="arrow-right" className="size-3 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <ProgressTrack progress={brand.progress} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
      </div>
    </div>
  );
}
