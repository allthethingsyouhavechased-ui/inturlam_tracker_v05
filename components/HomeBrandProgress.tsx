import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import EmptyState from "@/components/EmptyState";
import { buttonClass } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { brandAccentStyle } from "@/lib/brandAccent";
import { TASK_STATUS_LABEL, TASK_STATUS_TEXT } from "@/lib/constants";
import { formatPoints } from "@/lib/progress";
import type { BrandMonthlyProgressRow } from "@/lib/repositories/progress";
import type { MonthlyProgress, TaskStatus } from "@/lib/types";

function ProgressTrack({ progress, brand = false }: { progress: MonthlyProgress; brand?: boolean }) {
  const width = progress.percent === null ? 0 : Math.min(100, Math.max(0, progress.percent));
  return (
    <div
      className="mt-2 h-1.5 overflow-hidden rounded-md bg-surface-muted"
      role={progress.percent === null ? undefined : "progressbar"}
      aria-label={progress.percent === null ? "Bu ay plan yok" : `Aylık ilerleme yüzde ${progress.percent}`}
      aria-valuemin={progress.percent === null ? undefined : 0}
      aria-valuemax={progress.percent === null ? undefined : 100}
      aria-valuenow={progress.percent ?? undefined}
    >
      {progress.percent !== null && <div className={`h-full ${brand ? "brand-accent-fill" : "bg-brand-600"}`} style={{ width: `${width}%` }} />}
    </div>
  );
}

function ProgressValue({ progress, showPoints = true }: { progress: MonthlyProgress; showPoints?: boolean }) {
  return (
    <div>
      <p className="font-display text-2xl font-semibold text-foreground">{progress.percent === null ? "Plan yok" : `%${progress.percent}`}</p>
      {showPoints && <p className="mt-0.5 text-[11px] tabular-nums text-muted">{formatPoints(progress.weighted_earned)} / {formatPoints(progress.weighted_total)} puan</p>}
    </div>
  );
}

interface HomeBrandProgressProps {
  month: string;
  portfolioBrands: BrandMonthlyProgressRow[];
  portfolioProgress: MonthlyProgress;
  portfolioStatusCounts: Record<TaskStatus, number>;
  personalProgress: MonthlyProgress;
  assignedBrandIds: string[];
  section?: "all" | "summary" | "details";
}

export default function HomeBrandProgress({
  month,
  portfolioBrands,
  portfolioProgress,
  portfolioStatusCounts,
  personalProgress,
  assignedBrandIds,
  section = "all",
}: HomeBrandProgressProps) {
  const assigned = new Set(assignedBrandIds);
  const plannedBrandCount = portfolioBrands.filter((brand) => brand.progress.percent !== null).length;
  const statuses: TaskStatus[] = ["Beklemede", "DevamEdiyor", "Incelemede", "Onaylandi", "Yayinlandi"];

  return (
    <div className="space-y-5">
      {section !== "details" && <section aria-label="Aylık analiz özeti" className="grid gap-px overflow-hidden rounded-xl border border-border-default bg-border-subtle sm:grid-cols-3">
        <div className="bg-surface px-4 py-4 sm:px-5">
          <p className="text-eyebrow text-brand-600 dark:text-brand-300">BENİM AYLIK İLERLEMEM</p>
          <div className="mt-1"><ProgressValue progress={personalProgress} showPoints={false} /></div>
          <ProgressTrack progress={personalProgress} />
        </div>
        <div className="bg-surface px-4 py-4 sm:px-5">
          <p className="text-eyebrow text-brand-600 dark:text-brand-300">BU AYKİ PUANIM</p>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div>
              <p className="font-display text-2xl font-semibold tabular-nums text-foreground">{formatPoints(personalProgress.weighted_earned)}</p>
              <p className="mt-0.5 text-[11px] tabular-nums text-muted">{formatPoints(personalProgress.weighted_total)} puanlık plandan</p>
            </div>
            {/* Düz metin bağlantıyken tıklanabilir olduğu anlaşılmıyordu —
                komşusu bir sayı bloğu, altı çizgisi yalnız hover'da çıkıyordu. */}
            <Link href={`/panom/katkim?month=${month}`} className={buttonClass({ variant: "secondary", size: "sm", className: "text-[11px]" })}>
              Katkı dökümü
              <Icon name="arrow-right" className="size-3.5" />
            </Link>
          </div>
        </div>
        <div className="bg-surface px-4 py-4 sm:px-5">
          <p className="text-eyebrow text-brand-600 dark:text-brand-300">PORTFÖY İLERLEMESİ</p>
          <div className="mt-1 flex items-end justify-between gap-3"><ProgressValue progress={portfolioProgress} /><span className="text-[11px] text-muted">{plannedBrandCount}/{portfolioBrands.length} marka planlı</span></div>
          <ProgressTrack progress={portfolioProgress} />
        </div>
      </section>}

      {section !== "summary" && <section aria-labelledby="monthly-flow-title" className="grid overflow-hidden rounded-xl border border-border-default bg-surface sm:grid-cols-2 xl:grid-cols-[minmax(15rem,1.25fr)_repeat(5,minmax(7rem,0.75fr))]">
        <div className="border-b border-border-subtle px-4 py-3.5 sm:col-span-2 sm:px-5 xl:col-span-1 xl:border-b-0 xl:border-r">
          <p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">AYLIK ÜRETİM AKIŞI</p>
          <h2 id="monthly-flow-title" className="mt-1 text-sm font-semibold text-foreground">{portfolioProgress.task_count} planlı görev</h2>
          <p className="mt-0.5 text-[11px] text-muted">Tüm markaların ağırlıklı durum dağılımı.</p>
        </div>
        {statuses.map((status) => (
          <div key={status} className="border-b border-border-subtle px-4 py-3 last:border-b-0 odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 xl:border-b-0 xl:border-r xl:odd:border-r xl:last:border-r-0">
            <p className={`text-[10px] font-semibold ${TASK_STATUS_TEXT[status]}`}>{TASK_STATUS_LABEL[status]}</p>
            <p className="mt-1 font-display text-xl font-semibold tabular-nums text-foreground">{portfolioStatusCounts[status]}</p>
          </div>
        ))}
      </section>}

      {section !== "summary" && <section className="overflow-hidden rounded-xl border border-border-default bg-surface">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border-subtle px-4 py-4 sm:px-5">
          <div><p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">PORTFÖY AYLIK İLERLEME</p><h2 className="mt-1 text-[15px] font-semibold text-foreground">Tüm markalar</h2><p className="mt-1 text-[11px] text-muted">Kişisel sorumlulukların aynı listede “Sen” etiketiyle görünür.</p></div>
          <Link href="/brands" className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">Portföy tablosu</Link>
        </div>
        {portfolioBrands.length === 0 ? (
          <div className="p-4"><EmptyState compact title="Aktif marka yok" description="Marka eklendiğinde aylık ilerleme burada görünür." /></div>
        ) : (
          <div className="grid max-h-[36rem] overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
            {portfolioBrands.map((brand) => (
              <Link
                key={brand.brand_id}
                href={`/brands/${brand.brand_id}?month=${month}`}
                data-brand-accent
                style={brandAccentStyle(brand.brand_accent_hue)}
                className="brand-stripe group min-w-0 border-b border-border-subtle px-4 py-3.5 hover:bg-surface-hover sm:border-r sm:px-5"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <BrandLogo name={brand.brand_name} logoPath={brand.brand_logo_path} accentHue={brand.brand_accent_hue} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="brand-name truncate text-xs font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-300">{brand.brand_name}</span>{assigned.has(brand.brand_id) && <span className="rounded-md bg-brand-100 px-1.5 py-0.5 text-[9px] font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-200">SEN</span>}<span className="ml-auto shrink-0 text-xs font-semibold tabular-nums text-secondary">{brand.progress.percent === null ? "Plan yok" : `%${brand.progress.percent}`}</span></div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-muted"><span>{brand.progress.task_count} görev · {formatPoints(brand.progress.weighted_earned)}/{formatPoints(brand.progress.weighted_total)} puan</span><Icon name="arrow-right" className="size-3 opacity-0 transition-opacity group-hover:opacity-100" /></div>
                    <ProgressTrack progress={brand.progress} brand />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>}
    </div>
  );
}
