"use client";

import EmptyState from "@/components/EmptyState";
import CollapsiblePanel from "@/components/reports/CollapsiblePanel";
import type {
  BrandReportRow,
  CycleTimeReport,
  DueHealthRow,
  PersonReportRow,
  TrendReport,
} from "@/lib/repositories/reports";

function formatDays(value: number | null): string {
  return value == null ? "—" : `${value.toLocaleString("tr-TR")} gün`;
}

export function TrendChart({ report, embedded = false }: { report: TrendReport; embedded?: boolean }) {
  const width = 760;
  const height = 260;
  const padding = { top: 22, right: 20, bottom: 40, left: 42 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(
    1,
    ...report.points.flatMap((point) => [point.opened_tasks, point.completed_tasks]),
  );
  const x = (index: number) =>
    padding.left + (report.points.length <= 1 ? plotWidth / 2 : (index / (report.points.length - 1)) * plotWidth);
  const y = (value: number) => padding.top + plotHeight - (value / maxValue) * plotHeight;
  const pathFor = (key: "opened_tasks" | "completed_tasks") =>
    report.points.map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${y(point[key])}`).join(" ");
  const labelStep = Math.max(1, Math.ceil(report.points.length / 7));
  const yTicks = Array.from(new Set([0, Math.ceil(maxValue / 2), maxValue]));

  const content = report.points.length === 0 ? (
    <EmptyState compact title="Trend verisi yok" description="Görev hareketleri oluştuğunda zaman grafiği burada görünecek." />
  ) : (
    <div>
      <div className="mb-2 flex flex-wrap justify-end gap-3 text-xs font-medium">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 bg-brand-500" aria-hidden="true" /> Açılan</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 bg-emerald-500" aria-hidden="true" /> Tamamlanan</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="trend-svg-title trend-svg-desc" className="h-auto w-full overflow-visible">
        <title id="trend-svg-title">Açılan ve tamamlanan görev trendi</title>
        <desc id="trend-svg-desc">Mavi çizgi açılan, yeşil çizgi tamamlanan görev sayısını gösterir. Ayrıntılı değerler erişilebilir tabloda da sunulur.</desc>
        {yTicks.map((tick) => (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} className="stroke-zinc-200 dark:stroke-zinc-800" strokeDasharray="3 5" />
            <text x={padding.left - 10} y={y(tick) + 4} textAnchor="end" className="fill-zinc-500 text-[10px] dark:fill-zinc-400">{tick}</text>
          </g>
        ))}
        <path d={pathFor("opened_tasks")} fill="none" className="stroke-brand-500" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d={pathFor("completed_tasks")} fill="none" className="stroke-emerald-500" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {report.points.map((point, index) => (
          <g key={point.key}>
            <circle cx={x(index)} cy={y(point.opened_tasks)} r="4" className="fill-white stroke-brand-500 dark:fill-zinc-900" strokeWidth="2"><title>{`${point.label}: ${point.opened_tasks} açılan görev`}</title></circle>
            <circle cx={x(index)} cy={y(point.completed_tasks)} r="4" className="fill-white stroke-emerald-500 dark:fill-zinc-900" strokeWidth="2"><title>{`${point.label}: ${point.completed_tasks} tamamlanan görev`}</title></circle>
            {(index % labelStep === 0 || index === report.points.length - 1) && (
              <text x={x(index)} y={height - 14} textAnchor="middle" className="fill-zinc-500 text-[10px] dark:fill-zinc-400">{point.label}</text>
            )}
          </g>
        ))}
      </svg>
      <table className="sr-only">
        <caption>Açılan ve tamamlanan görevlerin dönemsel değerleri</caption>
        <thead><tr><th>Dönem</th><th>Açılan</th><th>Tamamlanan</th></tr></thead>
        <tbody>{report.points.map((point) => <tr key={point.key}><td>{point.label}</td><td>{point.opened_tasks}</td><td>{point.completed_tasks}</td></tr>)}</tbody>
      </table>
    </div>
  );

  if (embedded) {
    return (
      <section aria-labelledby="trend-title" className="min-w-0">
        <div className="mb-4">
          <h3 id="trend-title" className="text-sm font-semibold text-foreground">İş akış trendi</h3>
          <p className="mt-1 text-xs text-muted">Dönemde açılan işlerle tamamlanan işlerin zamana göre karşılaştırması</p>
        </div>
        {content}
      </section>
    );
  }

  return (
    <CollapsiblePanel
      panelKey="trend"
      title="İş akış trendi"
      description="Dönemde açılan işlerle tamamlanan işlerin zamana göre karşılaştırması"
      defaultOpen={false}
      bodyClassName="px-4 pb-5 sm:px-5"
    >
      {content}
    </CollapsiblePanel>
  );
}

export function CycleTimePanel({ report, embedded = false }: { report: CycleTimeReport; embedded?: boolean }) {
  const maxValue = Math.max(1, ...report.buckets.map((bucket) => bucket.task_count));
  const content = (
    <>
      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-black/10 dark:bg-white/10">
        {[["Ortalama", report.average_days], ["Medyan", report.median_days], ["%75 sınırı", report.p75_days]].map(([label, value]) => (
          <div key={String(label)} className="bg-zinc-50 p-3 dark:bg-zinc-950/70">
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</dt>
            <dd className="mt-1 font-semibold tabular-nums">{formatDays(value as number | null)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 space-y-3">
        {report.buckets.map((bucket) => (
          <div key={bucket.key}>
            <div className="mb-1 flex items-center justify-between text-xs"><span className="font-medium">{bucket.label}</span><span className="tabular-nums text-zinc-500 dark:text-zinc-400">{bucket.task_count}</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10"><div className="h-full rounded-full bg-violet-500" style={{ width: `${(bucket.task_count / maxValue) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </>
  );

  if (embedded) {
    return (
      <section aria-labelledby="cycle-time-title">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 id="cycle-time-title" className="text-sm font-semibold text-foreground">Tamamlanma süresi</h3>
            <p className="mt-1 text-xs text-muted">Seçili dönemde tamamlanan görevlerin takvim günü</p>
          </div>
          <span className="shrink-0 rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium tabular-nums text-zinc-600 dark:bg-white/10 dark:text-zinc-300">{report.sample_size} görev</span>
        </div>
        {content}
      </section>
    );
  }

  return (
    <CollapsiblePanel
      panelKey="cycle-time"
      title="Tamamlanma süresi"
      description="Yalnızca seçili dönemde tamamlanan görevler; açılış ile tamamlanma arasındaki takvim günü"
      meta={
        <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium tabular-nums text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
          {report.sample_size} görev
        </span>
      }
    >
      {content}
    </CollapsiblePanel>
  );
}

const dueTone: Record<DueHealthRow["bucket"], string> = {
  overdue: "bg-rose-500",
  today: "bg-amber-500",
  next_seven: "bg-brand-500",
  later: "bg-emerald-500",
  unscheduled: "bg-zinc-400 dark:bg-zinc-600",
};

export function DueHealthPanel({ rows, embedded = false }: { rows: DueHealthRow[]; embedded?: boolean }) {
  const total = rows.reduce((sum, row) => sum + row.task_count, 0);
  const unscheduled = rows.find((row) => row.bucket === "unscheduled")?.task_count ?? 0;
  const coverage = total === 0 ? null : Math.round(((total - unscheduled) / total) * 100);
  const content = (
    <>
      {total > 0 && <div className="flex h-3 overflow-hidden rounded-full bg-black/5 dark:bg-white/10" aria-hidden="true">{rows.map((row) => <span key={row.bucket} className={dueTone[row.bucket]} style={{ width: `${(row.task_count / total) * 100}%` }} />)}</div>}
      <div className="@container mt-3">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-black/10 @sm:grid-cols-3 @2xl:grid-cols-5 dark:bg-white/10">
          {rows.map((row) => (
            <div key={row.bucket} className="min-w-0 bg-zinc-50 p-3 dark:bg-zinc-950/70">
              <dt className="flex min-w-0 items-start gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <span className={`mt-0.5 size-2 shrink-0 rounded-full ${dueTone[row.bucket]}`} aria-hidden="true" />
                <span className="leading-tight break-words">{row.label}</span>
              </dt>
              <dd className="mt-1 font-semibold tabular-nums">{row.task_count}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  );

  if (embedded) {
    return (
      <section aria-labelledby="due-health-title">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h3 id="due-health-title" className="text-sm font-semibold text-foreground">Teslim sağlığı</h3>
            <p className="mt-1 text-xs text-muted">Geciken, yaklaşan ve tarihi girilmemiş açık işlerin dağılımı</p>
          </div>
          <span className="text-right"><span className="block text-lg font-semibold tabular-nums">{coverage == null ? "—" : `%${coverage}`}</span><span className="block text-[10px] uppercase tracking-wide text-muted">tarih kapsamı</span></span>
        </div>
        {content}
      </section>
    );
  }

  return (
    <CollapsiblePanel
      panelKey="due-health"
      title="Teslim sağlığı"
      description="Dönemden bağımsız güncel açık işler; geciken, yaklaşan ve tarihi girilmemiş görev dağılımı"
      meta={
        <span className="block text-right">
          <span className="block text-lg font-semibold tabular-nums">{coverage == null ? "—" : `%${coverage}`}</span>
          <span className="block text-[10px] font-normal uppercase tracking-wide text-zinc-500 dark:text-zinc-400">tarih kapsamı</span>
        </span>
      }
    >
      {content}
    </CollapsiblePanel>
  );
}

function WorkloadList({ rows, kind }: { rows: Array<PersonReportRow | BrandReportRow>; kind: "person" | "brand" }) {
  const sorted = [...rows].sort((a, b) => b.open_tasks - a.open_tasks).slice(0, 6);
  const maxOpen = Math.max(1, ...sorted.map((row) => row.open_tasks));
  return (
    <div className="space-y-3">
      {sorted.map((row) => {
        const id = kind === "person" ? (row as PersonReportRow).person_id : (row as BrandReportRow).brand_id;
        const name = kind === "person" ? (row as PersonReportRow).person_name : (row as BrandReportRow).brand_name;
        return (
          <div key={id}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-medium">{name}</span>
              <span className="shrink-0 tabular-nums text-zinc-500 dark:text-zinc-400">{row.open_tasks} açık · {row.completed_tasks} tamamlanan{row.overdue_tasks > 0 && <span className="ml-1 text-danger">· {row.overdue_tasks} geciken</span>}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10"><div className="h-full rounded-full bg-brand-500" style={{ width: `${(row.open_tasks / maxOpen) * 100}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

export function WorkloadComparison({ people, brands, embedded = false }: { people: PersonReportRow[]; brands: BrandReportRow[]; embedded?: boolean }) {
  if (embedded) {
    return (
      <div className="grid gap-5 lg:grid-cols-2 lg:divide-x lg:divide-border-subtle">
        <section className="min-w-0 lg:pr-8">
          <h3 className="text-sm font-semibold text-foreground">Kişi bazlı iş yükü</h3>
          <p className="mb-5 mt-1 text-xs text-muted">En fazla açık işi bulunan ekip üyeleri</p>
          <WorkloadList rows={people} kind="person" />
        </section>
        <section className="min-w-0 lg:pl-8">
          <h3 className="text-sm font-semibold text-foreground">Marka bazlı iş yükü</h3>
          <p className="mb-5 mt-1 text-xs text-muted">En fazla açık işi bulunan markalar</p>
          <WorkloadList rows={brands} kind="brand" />
        </section>
      </div>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <CollapsiblePanel
        panelKey="workload-people"
        title="Kişi bazlı iş yükü"
        description="En fazla açık işi bulunan ekip üyeleri"
      >
        <WorkloadList rows={people} kind="person" />
      </CollapsiblePanel>
      <CollapsiblePanel
        panelKey="workload-brands"
        title="Marka bazlı iş yükü"
        description="En fazla açık işi bulunan markalar"
      >
        <WorkloadList rows={brands} kind="brand" />
      </CollapsiblePanel>
    </div>
  );
}
