"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import { brandAccentStyle } from "@/lib/brandAccent";
import CollapsiblePanel from "@/components/reports/CollapsiblePanel";
import DeliveryQualityPanel from "@/components/reports/DeliveryQualityPanel";
import {
  MetricCard,
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
    <div className="space-y-6">
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

      <nav
        aria-label="Rapor kırılımları"
        className="grid overflow-hidden rounded-xl border border-border-default bg-surface sm:grid-cols-3"
      >
        {[
          {
            href: "#departman-raporu",
            eyebrow: "DEPARTMAN",
            title: `${departments.length} çalışma alanı`,
            description: "Üretim, açık yük ve teslim performansı",
          },
          {
            href: "#kisi-raporu",
            eyebrow: "EKİP",
            title: `${people.length} kişi`,
            description: "Kişi bazında iş yükü ve tamamlanma",
          },
          {
            href: "#marka-raporu",
            eyebrow: "PORTFÖY",
            title: `${visibleBrands.length} marka`,
            description: "Marka bazında üretim ve teslim sağlığı",
          },
        ].map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="group min-w-0 border-b border-border-subtle px-4 py-3 transition-colors hover:bg-surface-hover last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"
          >
            <span className="block text-[10px] font-semibold tracking-[0.08em] text-brand-600 dark:text-brand-300">
              {item.eyebrow}
            </span>
            <span className="mt-1 block text-sm font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-300">
              {item.title} →
            </span>
            <span className="mt-0.5 block truncate text-[11px] text-muted">
              {item.description}
            </span>
          </a>
        ))}
      </nav>

      <section aria-labelledby="report-summary-title" className="space-y-3">
        <div>
          <h2 id="report-summary-title" className="text-lg font-semibold">
            Operasyon özeti
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Açılan ve tamamlanan seçili dönemi; açık ve geciken değerleri bugünkü iş
            yükünü gösterir.
          </p>
        </div>
        <div className="report-surface grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-black/10 bg-black/10 dark:border-white/10 dark:bg-white/10 md:grid-cols-4 xl:grid-cols-8">
          <MetricCard
            label="Dönemde açılan"
            value={summary.opened_tasks}
            note={comparePeriod(summary.opened_tasks, previousSummary?.opened_tasks)}
          />
          <MetricCard
            label="Tamamlanan"
            value={summary.completed_tasks}
            note={comparePeriod(summary.completed_tasks, previousSummary?.completed_tasks)}
            tone="success"
          />
          <MetricCard
            label="Akış dengesi"
            value={netFlow > 0 ? `+${netFlow}` : netFlow}
            note="Tamamlanan − açılan"
            tone={netFlow >= 0 ? "success" : "danger"}
          />
          <MetricCard
            label="Karşılama"
            value={completionCoverage == null ? "—" : `%${completionCoverage}`}
            note="Tamamlanan / açılan"
            tone={completionCoverage != null && completionCoverage >= 100 ? "success" : "neutral"}
          />
          <MetricCard
            label="Açık iş yükü"
            value={summary.open_tasks}
            note="Güncel iş yükü"
          />
          <MetricCard
            label="Geciken"
            value={summary.overdue_tasks}
            note="Teslim tarihi geçmiş"
            tone={summary.overdue_tasks > 0 ? "danger" : "neutral"}
          />
          <MetricCard
            label="Zamanında"
            value={formatRate(summary.on_time_rate)}
            note="Tamamlanan tarihli işler"
            tone="success"
          />
          <MetricCard
            label="Tarih kapsamı"
            value={dueCoverage == null ? "—" : `%${dueCoverage}`}
            note="Açık işlerde teslim tarihi"
          />
        </div>
      </section>

      <section aria-label="Rapor öne çıkanları" className="grid gap-3 lg:grid-cols-3">
        <div className="report-surface rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            En yoğun kişi
          </p>
          <p className="mt-2 truncate text-base font-semibold">
            {busiestPerson?.person_name ?? "Veri yok"}
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {busiestPerson ? `${busiestPerson.open_tasks} açık görev` : "Henüz iş yükü oluşmadı"}
          </p>
        </div>
        <div className="report-surface rounded-2xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            En yoğun marka
          </p>
          <p className="mt-2 truncate text-base font-semibold">
            {busiestBrand?.brand_name ?? "Veri yok"}
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {busiestBrand ? `${busiestBrand.open_tasks} açık görev` : "Henüz iş yükü oluşmadı"}
          </p>
        </div>
        <div
          className={`rounded-2xl border p-4 ${
            summary.overdue_tasks > 0
              ? "border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20"
              : "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Takip gerektiren
          </p>
          <p className="mt-2 text-base font-semibold">
            {summary.overdue_tasks > 0
              ? `${summary.overdue_tasks} gecikmiş görev`
              : "Gecikmiş görev yok"}
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {summary.overdue_tasks > 0 ? "Önceliklendirme gerekebilir" : "Teslim görünümü sağlıklı"}
          </p>
        </div>
      </section>

      <section aria-label="Süre ve teslim analizi" className="grid items-start gap-4 xl:grid-cols-2">
        <CycleTimePanel report={cycleTime} />
        <DueHealthPanel rows={dueHealth} />
      </section>

      <WorkloadComparison people={people} brands={visibleBrands} />

      <CollapsiblePanel
        panelKey="workflow"
        title="Aktif iş akışı"
        description="İşlerin şu anda hangi aşamada beklediği"
        meta={<span className="tabular-nums">{workflowTotal} açık görev</span>}
      >
        {workflowTotal === 0 ? (
          <EmptyState
            compact
            title="Aktif iş akışı boş"
            description="Açık görev oluştuğunda durum dağılımı burada görünecek."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {workflow.map((row) => {
              const percentage = (row.task_count / workflowTotal) * 100;
              return (
                <div key={row.status}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium">{TASK_STATUS_LABEL[row.status]}</span>
                    <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                      {row.task_count}
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10"
                    role="progressbar"
                    aria-label={`${TASK_STATUS_LABEL[row.status]} görevleri`}
                    aria-valuemin={0}
                    aria-valuemax={workflowTotal}
                    aria-valuenow={row.task_count}
                  >
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ${TASK_STATUS_PROGRESS[row.status]}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel
        panelKey="delivery-quality"
        title="Teslim ve revize kalitesi"
        description="Versiyonlu teslimlerin onay oranı, revize nedenleri ve marka dağılımı."
        meta={<span className="tabular-nums text-muted">{deliveryQuality.total_deliveries} versiyon</span>}
        defaultOpen={false}
      >
        <DeliveryQualityPanel report={deliveryQuality} />
      </CollapsiblePanel>

      <CollapsiblePanel
        panelKey="team-monthly-score"
        title="Ekip aylık puanı"
        description="Teslim tarihi bu ayda olan görevlerin ağırlıklı durum ilerlemesi."
        meta={<span className="tabular-nums text-muted">{teamMonthlyProgress.filter((row) => row.progress.percent !== null).length}/{teamMonthlyProgress.length} kişi planlı</span>}
        defaultOpen={false}
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {teamMonthlyProgress.map((row) => (
            <div key={row.person_id} className="rounded-lg border border-border-subtle bg-surface-subtle px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate font-semibold text-foreground">{row.person_name}</span>
                <span className="shrink-0 tabular-nums text-muted">{row.progress.percent === null ? "Bu ay plan yok" : `%${row.progress.percent} · ${formatPoints(row.progress.weighted_earned)}/${formatPoints(row.progress.weighted_total)} puan`}</span>
              </div>
              {row.progress.percent !== null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background"><div className="h-full rounded-full bg-brand-600" style={{ width: `${row.progress.percent}%` }} /></div>}
            </div>
          ))}
        </div>
      </CollapsiblePanel>

      <section id="departman-raporu" className="scroll-mt-24 space-y-3">
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

      <section id="kisi-raporu" className="scroll-mt-24 space-y-3">
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

      <section id="marka-raporu" className="scroll-mt-24 space-y-3">
        <ReportSectionHeader
          title="Marka görünümü"
          description="Üretim hacmi, açık işler ve teslim sağlığı"
          tableVisible={showBrandTable}
          onToggleTable={() => setShowBrandTable((visible) => !visible)}
          onExportCSV={exportBrandsCSV}
          extra={(
            <label className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm text-secondary">
              <input
                type="checkbox"
                checked={hideArchived}
                onChange={(event) => setHideArchived(event.target.checked)}
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
                  data-brand-accent
                  style={brandAccentStyle(brand.brand_accent_hue)}
                  className={`border-b border-border-subtle transition-colors last:border-0 hover:bg-surface-hover ${
                    brand.brand_id === busiestBrand?.brand_id
                      ? "bg-brand-50/45 dark:bg-brand-950/15"
                      : ""
                  }`}
                >
                  <td className="border-l-[3px] border-l-[var(--brand-accent)] px-4 py-3">
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

      <div className="border-t border-border-subtle pt-6">
        <p className="mb-3 text-[11px] font-semibold tracking-[0.08em] text-muted">
          İLERİ ANALİZ
        </p>
        <TrendChart report={trend} />
      </div>
    </div>
  );
}
