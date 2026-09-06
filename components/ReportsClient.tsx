"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import CollapsiblePanel from "@/components/reports/CollapsiblePanel";
import DeliveryQualityPanel from "@/components/reports/DeliveryQualityPanel";
import {
  ReportSectionHeader,
  comparePeriod,
  formatDays,
  formatRate,
} from "@/components/reports/ReportPrimitives";
import { formatPoints } from "@/lib/progress";
import RangeFilterBar, {
  ExcelDownloadLink,
  PrintButton,
  type RangeKey,
} from "@/components/reports/RangeFilterBar";
import {
  CycleTimePanel,
  DueHealthPanel,
  TrendChart,
  WorkloadComparison,
} from "@/components/reports/ReportVisuals";
import {
  TASK_STATUS_LABEL,
  TASK_STATUS_PROGRESS,
} from "@/lib/constants";
import { downloadCSV, toCSV } from "@/lib/csv";
import {
  DEPARTMENTS,
  NO_DEPARTMENT,
  NO_DEPARTMENT_LABEL,
  departmentKey,
  departmentLabel,
} from "@/lib/departments";
import type {
  BrandReportRow,
  CycleTimeReport,
  DeliveryQualityReport,
  DepartmentReportRow,
  DueHealthRow,
  PersonReportRow,
  ReportSummary,
  TrendReport,
  WorkflowReportRow,
} from "@/lib/repositories/reports";
import type { MonthlyProgress } from "@/lib/types";

export type { RangeKey };

interface BrandBreakdown {
  brand_id: string;
  brand_name: string;
  brand_accent_hue: number;
  total_tasks: number;
  completed_tasks: number;
  open_tasks: number;
}

interface PersonBreakdown {
  person_id: string;
  person_name: string;
  total_tasks: number;
  completed_tasks: number;
  open_tasks: number;
}

export interface PersonReportView extends PersonReportRow {
  brands: BrandBreakdown[];
}

export interface BrandReportView extends BrandReportRow {
  people: PersonBreakdown[];
}

type AnalysisView = "workload" | "workflow" | "quality" | "score";
type DetailView = "department" | "people" | "brands";
const SUMMARY_METRICS: Record<string,string> = { "Dönemde açılan": "opened", "Tamamlanan": "completed", "Açık iş": "open", "Geciken": "overdue" };

export default function ReportsClient({
  summary,
  previousSummary,
  workflow,
  trend,
  cycleTime,
  deliveryQuality,
  dueHealth,
  departments,
  people,
  brands,
  rangeKey,
  customStart,
  customEnd,
  reportLabel,
  generatedAt,
  teamMonthlyProgress,
}: {
  summary: ReportSummary;
  previousSummary: ReportSummary | null;
  workflow: WorkflowReportRow[];
  trend: TrendReport;
  cycleTime: CycleTimeReport;
  deliveryQuality: DeliveryQualityReport;
  dueHealth: DueHealthRow[];
  departments: DepartmentReportRow[];
  people: PersonReportView[];
  brands: BrandReportView[];
  rangeKey: RangeKey;
  customStart: string;
  customEnd: string;
  reportLabel: string;
  generatedAt: string;
  teamMonthlyProgress: Array<{ person_id: string; person_name: string; progress: MonthlyProgress }>;
}) {
  const [hideArchived, setHideArchived] = useState(false);
  const [showDepartmentTable, setShowDepartmentTable] = useState(true);
  const [showPeopleTable, setShowPeopleTable] = useState(true);
  const [showBrandTable, setShowBrandTable] = useState(true);
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [analysisView, setAnalysisView] = useState<AnalysisView>("workload");
  const [detailView, setDetailView] = useState<DetailView>("department");

  const visibleBrands = hideArchived ? brands.filter((brand) => brand.archived === 0) : brands;
  const workflowTotal = workflow.reduce((total, row) => total + row.task_count, 0);

  // Departman sekmeleri yalnızca ekip tablosunu daraltır; üstteki portföy
  // özeti ve marka tablosu her zaman tüm ekibi gösterir.
  const departmentTabs = useMemo(() => {
    const counts = new Map<string, number>();
    for (const person of people) {
      const key = departmentKey(person.department);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [
      { id: "", label: "Tümü", count: people.length },
      ...DEPARTMENTS.map((option) => ({
        id: option.id as string,
        label: option.label,
        count: counts.get(option.id) ?? 0,
      })),
      { id: NO_DEPARTMENT, label: NO_DEPARTMENT_LABEL, count: counts.get(NO_DEPARTMENT) ?? 0 },
    ].filter((tab) => tab.id === "" || tab.count > 0 || tab.id === departmentFilter);
  }, [people, departmentFilter]);

  const visiblePeople = useMemo(
    () =>
      departmentFilter
        ? people.filter((person) => departmentKey(person.department) === departmentFilter)
        : people,
    [people, departmentFilter],
  );

  // Kişi detayına geçerken seçili dönem korunur — aksi halde "bu ay" raporundan
  // tıklayan kişi sessizce "tüm zamanlar" verisine düşerdi.
  const rangeQuery =
    rangeKey === "all"
      ? ""
      : rangeKey === "custom"
        ? `?range=custom&start=${customStart}&end=${customEnd}`
        : `?range=${rangeKey}`;

  // Departman satırının altında açılan kişi listesi — ayrı bir sorgu yerine
  // zaten elde olan kişi satırlarından türetiliyor.
  const peopleByDepartment = useMemo(() => {
    const map = new Map<string, PersonReportView[]>();
    for (const person of people) {
      const key = departmentKey(person.department);
      map.set(key, [...(map.get(key) ?? []), person]);
    }
    return map;
  }, [people]);

  const busiestDepartment = departments.reduce<DepartmentReportRow | null>(
    (current, department) =>
      !current || department.open_tasks > current.open_tasks ? department : current,
    null,
  );
  const maxDepartmentOpen = Math.max(1, ...departments.map((row) => row.open_tasks));

  const busiestPerson = people.reduce<PersonReportView | null>(
    (current, person) =>
      !current || person.open_tasks > current.open_tasks ? person : current,
    null,
  );
  const busiestBrand = visibleBrands.reduce<BrandReportView | null>(
    (current, brand) =>
      !current || brand.open_tasks > current.open_tasks ? brand : current,
    null,
  );
  const maxPersonOpen = Math.max(1, ...visiblePeople.map((person) => person.open_tasks));
  const maxBrandOpen = Math.max(1, ...visibleBrands.map((brand) => brand.open_tasks));
  const completionCoverage =
    summary.opened_tasks === 0
      ? null
      : Math.round((summary.completed_tasks / summary.opened_tasks) * 100);
  const netFlow = summary.completed_tasks - summary.opened_tasks;
  const dueTotal = dueHealth.reduce((total, row) => total + row.task_count, 0);
  const unscheduled = dueHealth.find((row) => row.bucket === "unscheduled")?.task_count ?? 0;
  const dueCoverage = dueTotal === 0 ? null : Math.round(((dueTotal - unscheduled) / dueTotal) * 100);

  function exportDepartmentsCSV() {
    const rows = departments.map((row) => ({
      department: departmentLabel(row.department),
      person_count: row.person_count,
      opened_tasks: row.total_tasks,
      completed_tasks: row.completed_tasks,
      open_tasks: row.open_tasks,
      overdue_tasks: row.overdue_tasks,
      on_time_rate: formatRate(row.on_time_rate),
      average_cycle: formatDays(row.average_cycle_days),
    }));
    const csv = toCSV(rows, [
      { key: "department", label: "Departman" },
      { key: "person_count", label: "Kişi" },
      { key: "opened_tasks", label: "Dönemde Açılan" },
      { key: "completed_tasks", label: "Dönemde Tamamlanan" },
      { key: "open_tasks", label: "Açık İş Yükü" },
      { key: "overdue_tasks", label: "Gecikmiş" },
      { key: "on_time_rate", label: "Zamanında Tamamlama" },
      { key: "average_cycle", label: "Ortalama Süre" },
    ]);
    downloadCSV("departman-raporu.csv", csv);
  }

  function exportPeopleCSV() {
    const rows = visiblePeople.map((person) => ({
      person_name: person.person_name,
      department: departmentLabel(person.department),
      opened_tasks: person.total_tasks,
      completed_tasks: person.completed_tasks,
      open_tasks: person.open_tasks,
      overdue_tasks: person.overdue_tasks,
      on_time_rate: formatRate(person.on_time_rate),
      average_cycle: formatDays(person.average_cycle_days),
    }));
    const csv = toCSV(rows, [
      { key: "person_name", label: "Kişi" },
      { key: "department", label: "Departman" },
      { key: "opened_tasks", label: "Dönemde Açılan" },
      { key: "completed_tasks", label: "Dönemde Tamamlanan" },
      { key: "open_tasks", label: "Açık İş Yükü" },
      { key: "overdue_tasks", label: "Gecikmiş" },
      { key: "on_time_rate", label: "Zamanında Tamamlama" },
      { key: "average_cycle", label: "Ortalama Süre" },
    ]);
    downloadCSV("kisi-raporu.csv", csv);
  }

  function exportBrandsCSV() {
    const rows = visibleBrands.map((brand) => ({
      brand_name: brand.brand_name,
      total_content: brand.total_content,
      opened_tasks: brand.total_tasks,
      completed_tasks: brand.completed_tasks,
      open_tasks: brand.open_tasks,
      overdue_tasks: brand.overdue_tasks,
      on_time_rate: formatRate(brand.on_time_rate),
      average_cycle: formatDays(brand.average_cycle_days),
    }));
    const csv = toCSV(rows, [
      { key: "brand_name", label: "Marka" },
      { key: "total_content", label: "Yeni İçerik" },
      { key: "opened_tasks", label: "Dönemde Açılan" },
      { key: "completed_tasks", label: "Dönemde Tamamlanan" },
      { key: "open_tasks", label: "Açık İş Yükü" },
      { key: "overdue_tasks", label: "Gecikmiş" },
      { key: "on_time_rate", label: "Zamanında Tamamlama" },
      { key: "average_cycle", label: "Ortalama Süre" },
    ]);
    downloadCSV("marka-raporu.csv", csv);
  }

  return (
    <div className="space-y-4">
      <div className="hidden items-start justify-between border-b border-zinc-300 pb-4 print:flex">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">İNTURLAM · OPERASYON RAPORU</p>
          <h1 className="mt-1 text-2xl font-semibold">Yönetim özeti</h1>
          <p className="mt-1 text-sm text-zinc-600">{reportLabel}</p>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <p>Hazırlanma tarihi</p>
          <p className="mt-1 font-medium text-zinc-800">{generatedAt}</p>
        </div>
      </div>

      <RangeFilterBar rangeKey={rangeKey} customStart={customStart} customEnd={customEnd}>
        <ExcelDownloadLink
          rangeKey={rangeKey}
          customStart={customStart}
          customEnd={customEnd}
        />
        <PrintButton />
      </RangeFilterBar>

      <CollapsiblePanel
        panelKey="reports-management"
        titleId="report-summary-title"
        title="Yönetim görünümü"
        description="Seçili dönem üretimi ile güncel operasyon yükünün tek görünümü"
        meta={reportLabel}
        bodyClassName=""
      >
        <dl className="grid grid-cols-2 divide-x divide-y divide-border-subtle sm:grid-cols-3 xl:grid-cols-6 xl:divide-y-0">
          {[
            ["Dönemde açılan", summary.opened_tasks, comparePeriod(summary.opened_tasks, previousSummary?.opened_tasks), "text-foreground"],
            ["Tamamlanan", summary.completed_tasks, comparePeriod(summary.completed_tasks, previousSummary?.completed_tasks), "text-success"],
            ["Akış dengesi", netFlow > 0 ? `+${netFlow}` : netFlow, "Tamamlanan − açılan", netFlow >= 0 ? "text-success" : "text-danger"],
            ["Açık iş", summary.open_tasks, "Güncel iş yükü", "text-info"],
            ["Geciken", summary.overdue_tasks, "Teslim tarihi geçmiş", summary.overdue_tasks > 0 ? "text-danger" : "text-foreground"],
            ["Zamanında", formatRate(summary.on_time_rate), "Tamamlanan tarihli işler", "text-success"],
          ].map(([label, value, note, tone]) => (
            <div key={String(label)} className="min-w-0 px-4 py-3">
              <dt className="text-eyebrow text-brand-600 dark:text-brand-300">{label}</dt>
              <dd className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>
                {SUMMARY_METRICS[String(label)] ? <Link className="underline decoration-current/30 underline-offset-4 hover:decoration-current" aria-label={`${label}: ${value} görev, ayrıntıları aç`} href={`/reports/tasks${rangeQuery || '?range=all'}&metric=${SUMMARY_METRICS[String(label)]}`}>{value}</Link> : value}
              </dd>
              <p className="mt-1 truncate text-[11px] text-muted">{note}</p>
            </div>
          ))}
        </dl>
        <dl className="grid border-t border-border-subtle sm:grid-cols-2 xl:grid-cols-4 xl:divide-x xl:divide-border-subtle">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5"><dt className="text-xs text-muted">Karşılama oranı</dt><dd className="font-semibold tabular-nums">{completionCoverage == null ? "—" : `%${completionCoverage}`}</dd></div>
          <div className="flex items-center justify-between gap-3 border-t border-border-subtle px-4 py-2.5 sm:border-t-0"><dt className="text-xs text-muted">Teslim tarihi kapsamı</dt><dd className="font-semibold tabular-nums">{dueCoverage == null ? "—" : `%${dueCoverage}`}</dd></div>
          <div className="flex min-w-0 items-center justify-between gap-3 border-t border-border-subtle px-4 py-2.5 xl:border-t-0"><dt className="text-xs text-muted">En yoğun kişi</dt><dd className="truncate text-sm font-semibold">{busiestPerson ? `${busiestPerson.person_name} · ${busiestPerson.open_tasks}` : "Veri yok"}</dd></div>
          <div className="flex min-w-0 items-center justify-between gap-3 border-t border-border-subtle px-4 py-2.5 xl:border-t-0"><dt className="text-xs text-muted">En yoğun marka</dt><dd className="truncate text-sm font-semibold">{busiestBrand ? `${busiestBrand.brand_name} · ${busiestBrand.open_tasks}` : "Veri yok"}</dd></div>
        </dl>
      </CollapsiblePanel>

      <CollapsiblePanel
        panelKey="reports-analysis"
        titleId="analysis-workspace-title"
        title="Operasyon analizi"
        description="İş yükü, aktif akış, teslim kalitesi ve aylık puan"
        bodyClassName="p-3 sm:p-4"
        actions={(
          <div role="tablist" aria-label="Operasyon analizi" className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-brand-500/25 bg-brand-500/[0.06] p-1 print:hidden">
            {([
              ["workload", "İş yükü"],
              ["workflow", `Aktif akış · ${workflowTotal}`],
              ["quality", `Teslim kalitesi · ${deliveryQuality.total_deliveries}`],
              ["score", "Aylık puan"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={analysisView === id}
                onClick={() => setAnalysisView(id)}
                className={`ui-press min-h-9 shrink-0 rounded-md px-3 text-xs font-semibold transition-colors ${analysisView === id ? "bg-brand-600 text-white shadow-sm" : "text-brand-700 hover:bg-brand-500/10 dark:text-brand-300"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      >
          {analysisView === "workload" && <WorkloadComparison people={people} brands={visibleBrands} embedded />}
          {analysisView === "workflow" && (
            workflowTotal === 0 ? (
              <EmptyState compact title="Aktif iş akışı boş" description="Açık görev oluştuğunda durum dağılımı burada görünecek." />
            ) : (
              <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
                {workflow.map((row) => {
                  const percentage = (row.task_count / workflowTotal) * 100;
                  return (
                    <div key={row.status}>
                      <div className="mb-1.5 flex items-center justify-between text-sm"><span className="font-medium">{TASK_STATUS_LABEL[row.status]}</span><span className="tabular-nums text-muted">{row.task_count}</span></div>
                      <div className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10" role="progressbar" aria-label={`${TASK_STATUS_LABEL[row.status]} görevleri`} aria-valuemin={0} aria-valuemax={workflowTotal} aria-valuenow={row.task_count}>
                        <div className={`h-full rounded-full transition-[width] duration-500 ${TASK_STATUS_PROGRESS[row.status]}`} style={{ width: `${percentage}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
          {analysisView === "quality" && <DeliveryQualityPanel report={deliveryQuality} />}
          {analysisView === "score" && (
            <div className="divide-y divide-border-subtle">
              {teamMonthlyProgress.map((row) => (
                <div key={row.person_id} className="grid gap-2 py-3 first:pt-0 last:pb-0 sm:grid-cols-[minmax(10rem,0.7fr)_1fr_auto] sm:items-center">
                  <span className="truncate text-sm font-semibold text-foreground">{row.person_name}</span>
                  <div className="h-1.5 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-brand-600" style={{ width: `${row.progress.percent ?? 0}%` }} /></div>
                  <span className="shrink-0 text-xs tabular-nums text-muted">{row.progress.percent === null ? "Bu ay plan yok" : `%${row.progress.percent} · ${formatPoints(row.progress.weighted_earned)}/${formatPoints(row.progress.weighted_total)} puan`}</span>
                </div>
              ))}
            </div>
          )}
      </CollapsiblePanel>

      <CollapsiblePanel
        panelKey="reports-details"
        titleId="detail-workspace-title"
        title="Detay çalışma alanı"
        description="Aynı dönem içinde departman, ekip ve portföy kırılımları"
        bodyClassName="p-3 sm:p-4"
        actions={(
          <div role="tablist" aria-label="Rapor detayları" className="flex max-w-full gap-1 overflow-x-auto rounded-lg border border-brand-500/25 bg-brand-500/[0.06] p-1 print:hidden">
            {([
              ["department", `Departman · ${departments.length}`],
              ["people", `Ekip · ${people.length}`],
              ["brands", `Marka · ${visibleBrands.length}`],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={detailView === id}
                onClick={() => setDetailView(id)}
                className={`ui-press min-h-9 shrink-0 rounded-md px-3 text-xs font-semibold transition-colors ${detailView === id ? "bg-brand-600 text-white shadow-sm" : "text-brand-700 hover:bg-brand-500/10 dark:text-brand-300"}`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      >
      <section id="departman-raporu" hidden={detailView !== "department"} className="scroll-mt-24 space-y-3">
        <ReportSectionHeader
          title="Departman görünümü"
          description="Departmanın toplam üretimi ve teslim sağlığı — departman kişinin alanı olduğu için atanmamış görevler hiçbir satıra girmez"
          tableVisible={showDepartmentTable}
          onToggleTable={() => setShowDepartmentTable((visible) => !visible)}
          onExportCSV={exportDepartmentsCSV}
        />
        {showDepartmentTable && (
          <div className="report-surface ui-enter overflow-x-auto rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-zinc-50/90 dark:bg-zinc-950/70">
                <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wider text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                  <th className="px-4 py-3 font-medium">Departman</th>
                  <th className="px-3 py-3 font-medium">Kişi</th>
                  <th className="px-3 py-3 font-medium">Açılan</th>
                  <th className="px-3 py-3 font-medium">Tamamlanan</th>
                  <th className="px-3 py-3 font-medium">Açık</th>
                  <th className="px-3 py-3 font-medium">Geciken</th>
                  <th className="px-3 py-3 font-medium">Zamanında</th>
                  <th className="px-3 py-3 font-medium">Ort. süre</th>
                  <th className="px-3 py-3 font-medium print:hidden">
                    <span className="sr-only">Departman raporu</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {departments.map((row) => {
                  const members = peopleByDepartment.get(row.department) ?? [];
                  return (
                    <tr
                      key={row.department}
                      className={`border-b border-black/5 transition-colors last:border-0 hover:bg-black/[0.025] dark:border-white/5 dark:hover:bg-white/[0.025] ${
                        row.department === busiestDepartment?.department && row.open_tasks > 0
                          ? "bg-brand-50/45 dark:bg-brand-950/15"
                          : ""
                      }`}
                    >
                      <td className="px-4 py-3">
                        <details>
                          <summary className="cursor-pointer font-medium">
                            {departmentLabel(row.department)}
                            {row.department === busiestDepartment?.department &&
                              row.open_tasks > 0 && (
                                <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                                  en yoğun
                                </span>
                              )}
                          </summary>
                          {members.length > 0 ? (
                            <ul className="mt-2 space-y-1 pl-3 text-xs text-zinc-500 dark:text-zinc-400">
                              {members.map((person) => (
                                <li key={person.person_id}>
                                  {person.person_name}: {person.completed_tasks} tamamlanan,{" "}
                                  {person.open_tasks} açık
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 pl-3 text-xs text-zinc-500 dark:text-zinc-400">
                              Bu departmanda kayıtlı kişi yok.
                            </p>
                          )}
                        </details>
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        {row.person_count}
                        {row.person_count !== row.active_person_count && (
                          <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-400">
                            ({row.active_person_count} aktif)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 tabular-nums">{row.total_tasks}</td>
                      <td className="px-3 py-3 font-medium tabular-nums">
                        {row.completed_tasks}
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        <div className="flex items-center gap-2">
                          <span className="min-w-4">{row.open_tasks}</span>
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                            <span
                              className="block h-full rounded-full bg-brand-500"
                              style={{ width: `${(row.open_tasks / maxDepartmentOpen) * 100}%` }}
                            />
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 tabular-nums">
                        <span
                          className={
                            row.overdue_tasks > 0
                              ? "font-medium text-danger"
                              : undefined
                          }
                        >
                          {row.overdue_tasks}
                        </span>
                      </td>
                      <td className="px-3 py-3 tabular-nums">{formatRate(row.on_time_rate)}</td>
                      <td className="px-3 py-3 tabular-nums">
                        {formatDays(row.average_cycle_days)}
                      </td>
                      <td className="px-3 py-3 print:hidden">
                        <Link
                          href={`/reports/departman/${row.department}${rangeQuery}`}
                          className="whitespace-nowrap text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                        >
                          Detaylı rapor →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="kisi-raporu" hidden={detailView !== "people"} className="scroll-mt-24 space-y-3">
        <ReportSectionHeader
          title="Ekip görünümü"
          description="Performans puanı değil, iş yükü ve teslim görünümü — satır sonundaki bağlantı o kişinin detaylı raporunu açar"
          tableVisible={showPeopleTable}
          onToggleTable={() => setShowPeopleTable((visible) => !visible)}
          onExportCSV={exportPeopleCSV}
        />
        {showPeopleTable && (
          <div
            className="flex flex-wrap items-center gap-1.5 print:hidden"
            role="group"
            aria-label="Departmana göre filtrele"
          >
            <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Departman
            </span>
            {departmentTabs.map((tab) => (
              <button
                key={tab.id || "all"}
                type="button"
                onClick={() => setDepartmentFilter(tab.id)}
                aria-pressed={departmentFilter === tab.id}
                className={`ui-press inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${
                  departmentFilter === tab.id
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-black/10 bg-white text-zinc-600 hover:bg-black/5 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10"
                }`}
              >
                {tab.label}
                <span
                  className={`tabular-nums ${
                    departmentFilter === tab.id
                      ? "text-white/75"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        )}
        {showPeopleTable &&
          (visiblePeople.length > 0 ? (
        <div className="report-surface ui-enter overflow-x-auto rounded-xl border border-border-default bg-surface">
          <table className="w-full min-w-[1020px] text-sm">
            <thead className="bg-zinc-50/90 dark:bg-zinc-950/70">
              <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wider text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                <th className="px-4 py-3 font-medium">Kişi</th>
                <th className="px-3 py-3 font-medium">Departman</th>
                <th className="px-3 py-3 font-medium">Açılan</th>
                <th className="px-3 py-3 font-medium">Tamamlanan</th>
                <th className="px-3 py-3 font-medium">Açık</th>
                <th className="px-3 py-3 font-medium">Geciken</th>
                <th className="px-3 py-3 font-medium">Zamanında</th>
                <th className="px-3 py-3 font-medium">Ort. süre</th>
                <th className="px-3 py-3 font-medium print:hidden">
                  <span className="sr-only">Kişi raporu</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visiblePeople.map((person) => (
                <tr
                  key={person.person_id}
                  className={`border-b border-black/5 transition-colors last:border-0 hover:bg-black/[0.025] dark:border-white/5 dark:hover:bg-white/[0.025] ${
                    person.person_id === busiestPerson?.person_id
                      ? "bg-brand-50/45 dark:bg-brand-950/15"
                      : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <details>
                      <summary className="cursor-pointer font-medium">
                        {person.person_name}
                        {person.person_id === busiestPerson?.person_id &&
                          person.open_tasks > 0 && (
                            <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                              en yoğun
                            </span>
                          )}
                        {person.active === 0 && (
                          <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-normal text-zinc-500 dark:bg-white/10">
                            pasif
                          </span>
                        )}
                      </summary>
                      {person.brands.length > 0 && (
                        <ul className="mt-2 space-y-1 pl-3 text-xs text-zinc-500 dark:text-zinc-400">
                          {person.brands.map((brand) => (
                            <li key={brand.brand_id}>
                              {brand.brand_name}: {brand.completed_tasks} tamamlanan,{" "}
                              {brand.open_tasks} açık
                            </li>
                          ))}
                        </ul>
                      )}
                    </details>
                  </td>
                  <td className="px-3 py-3 text-xs text-zinc-500 dark:text-zinc-400">
                    {departmentLabel(person.department)}
                  </td>
                  <td className="px-3 py-3 tabular-nums">{person.total_tasks}</td>
                  <td className="px-3 py-3 font-medium tabular-nums">
                    {person.completed_tasks}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    <div className="flex items-center gap-2">
                      <span className="min-w-4">{person.open_tasks}</span>
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                        <span
                          className="block h-full rounded-full bg-brand-500"
                          style={{ width: `${(person.open_tasks / maxPersonOpen) * 100}%` }}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    <span
                      className={
                        person.overdue_tasks > 0
                          ? "font-medium text-danger"
                          : undefined
                      }
                    >
                      {person.overdue_tasks}
                    </span>
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatRate(person.on_time_rate)}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatDays(person.average_cycle_days)}
                  </td>
                  {/* Detay linki kendi sütununda: <summary>'nin içine koymak
                      satırı açıp kapatan tıklamayla çakışır, içine (açılan
                      gövdeye) koymak ise satır kapalıyken görünmez yapardı. */}
                  <td className="px-3 py-3 print:hidden">
                    <Link
                      href={`/reports/kisi/${encodeURIComponent(person.person_id)}${rangeQuery}`}
                      className="whitespace-nowrap text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                    >
                      Detaylı rapor →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          ) : (
            <EmptyState
              compact
              title={
                departmentFilter
                  ? "Bu departmanda kişi yok"
                  : "Ekip raporu için veri yok"
              }
              description={
                departmentFilter
                  ? "Ekip sayfasından kişilerin departmanını atayabilirsin."
                  : "Görevler kişilere atandığında ekip iş yükü burada görünecek."
              }
              action={
                departmentFilter ? (
                  <button
                    type="button"
                    onClick={() => setDepartmentFilter("")}
                    className="ui-press min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-500"
                  >
                    Tüm ekibi göster
                  </button>
                ) : undefined
              }
            />
          ))}
      </section>

      <section id="marka-raporu" hidden={detailView !== "brands"} className="scroll-mt-24 space-y-3">
        <ReportSectionHeader
          title="Marka görünümü"
          description="Üretim hacmi, açık işler ve teslim sağlığı"
          tableVisible={showBrandTable}
          onToggleTable={() => setShowBrandTable((visible) => !visible)}
          onExportCSV={exportBrandsCSV}
          extra={(
            <label className="flex min-h-9 items-center gap-2 rounded-md border border-brand-500/30 bg-brand-500/[0.06] px-3 text-sm text-brand-700 dark:text-brand-300">
              <input
                type="checkbox"
                checked={hideArchived}
                onChange={(event) => setHideArchived(event.target.checked)}
                className="accent-brand-600"
              />
              Arşivi gizle
            </label>
          )}
        />
        {showBrandTable &&
          (visibleBrands.length > 0 ? (
        <div className="report-surface ui-enter overflow-x-auto rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="bg-zinc-50/90 dark:bg-zinc-950/70">
              <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wider text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                <th className="px-4 py-3 font-medium">Marka</th>
                <th className="px-3 py-3 font-medium">Yeni içerik</th>
                <th className="px-3 py-3 font-medium">Açılan</th>
                <th className="px-3 py-3 font-medium">Tamamlanan</th>
                <th className="px-3 py-3 font-medium">Açık</th>
                <th className="px-3 py-3 font-medium">Geciken</th>
                <th className="px-3 py-3 font-medium">Zamanında</th>
                <th className="px-3 py-3 font-medium">Ort. süre</th>
              </tr>
            </thead>
            <tbody>
              {visibleBrands.map((brand) => (
                <tr
                  key={brand.brand_id}
                  className={`border-b border-border-subtle transition-colors last:border-0 hover:bg-surface-hover ${
                    brand.brand_id === busiestBrand?.brand_id
                      ? "bg-brand-50/45 dark:bg-brand-950/15"
                      : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <details>
                      <summary className="cursor-pointer font-medium">
                        {brand.brand_name}
                        {brand.brand_id === busiestBrand?.brand_id &&
                          brand.open_tasks > 0 && (
                            <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                              en yoğun
                            </span>
                          )}
                        {brand.archived === 1 && (
                          <span className="ml-2 rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-normal text-zinc-500 dark:bg-white/10">
                            arşiv
                          </span>
                        )}
                      </summary>
                      {brand.people.length > 0 && (
                        <ul className="mt-2 space-y-1 pl-3 text-xs text-zinc-500 dark:text-zinc-400">
                          {brand.people.map((person) => (
                            <li key={person.person_id}>
                              {person.person_name}: {person.completed_tasks} tamamlanan,{" "}
                              {person.open_tasks} açık
                            </li>
                          ))}
                        </ul>
                      )}
                    </details>
                  </td>
                  <td className="px-3 py-3 tabular-nums">{brand.total_content}</td>
                  <td className="px-3 py-3 tabular-nums">{brand.total_tasks}</td>
                  <td className="px-3 py-3 font-medium tabular-nums">
                    {brand.completed_tasks}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    <div className="flex items-center gap-2">
                      <span className="min-w-4">{brand.open_tasks}</span>
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                        <span
                          className="block h-full rounded-full bg-brand-500"
                          style={{ width: `${(brand.open_tasks / maxBrandOpen) * 100}%` }}
                        />
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    <span
                      className={
                        brand.overdue_tasks > 0
                          ? "font-medium text-danger"
                          : undefined
                      }
                    >
                      {brand.overdue_tasks}
                    </span>
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatRate(brand.on_time_rate)}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatDays(brand.average_cycle_days)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          ) : (
            <EmptyState
              compact
              title="Marka raporu için veri yok"
              description="İçerik ve görevler oluşturulduğunda marka görünümü burada dolacak."
            />
          ))}
      </section>
        <div className="hidden print:block">
          <p className="pt-3 text-xs text-muted">Yazdırma görünümünde sekmeli detayların tamamı dışa aktarma araçlarıyla ayrı ayrı alınabilir.</p>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel
        panelKey="reports-flow-health"
        titleId="flow-health-title"
        title="Akış ve teslim sağlığı"
        description="Üretim trendi, tamamlanma hızı ve yaklaşan teslim riski"
        bodyClassName=""
      >
        <div className="grid divide-y divide-border-subtle xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)_minmax(20rem,0.9fr)] xl:divide-x xl:divide-y-0">
          <div className="min-w-0 p-3 sm:p-4">
          <TrendChart report={trend} embedded />
          </div>
          <div className="min-w-0 p-3 sm:p-4"><CycleTimePanel report={cycleTime} embedded /></div>
          <div className="min-w-0 p-3 sm:p-4"><DueHealthPanel rows={dueHealth} embedded /></div>
        </div>
      </CollapsiblePanel>
    </div>
  );
}
