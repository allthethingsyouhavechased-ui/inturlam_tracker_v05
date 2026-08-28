"use client";

import Link from "next/link";
import {
  BrandBreakdownPanel,
  MetricCard,
  PriorityBreakdownPanel,
  ShareBar,
  TaskListPanel,
  TaskRow,
  WorkflowBreakdownPanel,
  comparePeriod,
  daysBetween,
  formatDays,
  formatRate,
} from "@/components/reports/ReportPrimitives";
import RangeFilterBar, {
  ExcelDownloadLink,
  PrintButton,
  type RangeKey,
} from "@/components/reports/RangeFilterBar";
import {
  CycleTimePanel,
  DueHealthPanel,
  TrendChart,
} from "@/components/reports/ReportVisuals";
import { TASK_PRIORITY_LABEL, TASK_STATUS_LABEL } from "@/lib/constants";
import { downloadCSV, toCSV } from "@/lib/csv";
import { formatDateShort } from "@/lib/date";
import type {
  CycleTimeReport,
  DueHealthRow,
  PriorityReportRow,
  ReportSummary,
  TrendReport,
  WorkflowReportRow,
} from "@/lib/repositories/reports";
import type { TaskWithContext } from "@/lib/types";

export interface PersonReportBrandRow {
  brand_id: string;
  brand_name: string;
  brand_accent_hue: number;
  total_tasks: number;
  completed_tasks: number;
  open_tasks: number;
}

export default function PersonReportClient({
  personId,
  personName,
  departmentLabel,
  personTitle,
  summary,
  previousSummary,
  teamSummary,
  teamSize,
  workflow,
  priorities,
  trend,
  cycleTime,
  dueHealth,
  brands,
  overdueTasks,
  upcomingTasks,
  completedTasks,
  upcomingDays,
  rangeKey,
  customStart,
  customEnd,
  reportLabel,
  generatedAt,
}: {
  personId: string;
  personName: string;
  departmentLabel: string;
  personTitle: string | null;
  summary: ReportSummary;
  previousSummary: ReportSummary | null;
  teamSummary: ReportSummary;
  teamSize: number;
  workflow: WorkflowReportRow[];
  priorities: PriorityReportRow[];
  trend: TrendReport;
  cycleTime: CycleTimeReport;
  dueHealth: DueHealthRow[];
  brands: PersonReportBrandRow[];
  overdueTasks: TaskWithContext[];
  upcomingTasks: TaskWithContext[];
  completedTasks: TaskWithContext[];
  upcomingDays: number;
  rangeKey: RangeKey;
  customStart: string;
  customEnd: string;
  reportLabel: string;
  generatedAt: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const teamAverageOpen = Math.round((teamSummary.open_tasks / teamSize) * 10) / 10;
  const teamAverageCompleted = Math.round((teamSummary.completed_tasks / teamSize) * 10) / 10;
  const workloadShare =
    teamSummary.open_tasks === 0
      ? null
      : Math.round((summary.open_tasks / teamSummary.open_tasks) * 100);
  const completionShare =
    teamSummary.completed_tasks === 0
      ? null
      : Math.round((summary.completed_tasks / teamSummary.completed_tasks) * 100);

  // Rapor tek cümlelik bir okuma ile başlasın: rakamları yorumlayan kısa özet.
  const headlineParts: string[] = [
    `${personName}, seçili dönemde ${summary.completed_tasks} iş tamamladı ve şu anda ${summary.open_tasks} açık işi var.`,
  ];
  if (summary.overdue_tasks > 0) {
    headlineParts.push(
      `Bunların ${summary.overdue_tasks} tanesinin teslim tarihi geçmiş — önce buraya bakılmalı.`,
    );
  } else if (summary.open_tasks > 0) {
    headlineParts.push("Gecikmiş işi yok, teslim görünümü sağlıklı.");
  }
  // Yüzdeye Türkçe iyelik eki getirmekten kaçınılıyor ("%16'i" / "%0'ini" gibi
  // yanlış ekler çıkıyordu); cümleler ekin sayıya bağlanmayacağı şekilde kuruldu.
  if (summary.on_time_rate != null) {
    headlineParts.push(
      `Teslim tarihi olan işlerde zamanında tamamlama oranı %${Math.round(summary.on_time_rate)}.`,
    );
  }
  if (workloadShare != null && summary.open_tasks > 0) {
    headlineParts.push(
      `Ekibin toplam açık iş yükündeki payı %${workloadShare} (ekip ortalaması ${teamAverageOpen.toLocaleString("tr-TR")} açık iş).`,
    );
  }

  function exportCSV() {
    const rows = [
      { metric: "Departman", value: departmentLabel },
      { metric: "Unvan", value: personTitle ?? "—" },
      { metric: "Dönem", value: reportLabel },
      { metric: "Dönemde açılan", value: String(summary.opened_tasks) },
      { metric: "Dönemde tamamlanan", value: String(summary.completed_tasks) },
      { metric: "Açık iş yükü", value: String(summary.open_tasks) },
      { metric: "Gecikmiş", value: String(summary.overdue_tasks) },
      { metric: "Zamanında tamamlama", value: formatRate(summary.on_time_rate) },
      { metric: "Ortalama tamamlanma süresi", value: formatDays(summary.average_cycle_days) },
      { metric: "Ekip ortalaması (açık)", value: teamAverageOpen.toLocaleString("tr-TR") },
      {
        metric: "Ekip ortalaması (tamamlanan)",
        value: teamAverageCompleted.toLocaleString("tr-TR"),
      },
      ...workflow.map((row) => ({
        metric: `Durum — ${TASK_STATUS_LABEL[row.status]}`,
        value: String(row.task_count),
      })),
      ...priorities.map((row) => ({
        metric: `Öncelik — ${TASK_PRIORITY_LABEL[row.priority]}`,
        value: String(row.open_tasks),
      })),
      ...brands.map((brand) => ({
        metric: `Marka — ${brand.brand_name}`,
        value: `${brand.completed_tasks} tamamlanan / ${brand.open_tasks} açık`,
      })),
      ...overdueTasks.map((task) => ({
        metric: `Gecikmiş görev — ${task.brand_name}`,
        value: `${task.title} (${formatDateShort(task.due_date)})`,
      })),
    ];
    const csv = toCSV(rows, [
      { key: "metric", label: "Başlık" },
      { key: "value", label: "Değer" },
    ]);
    downloadCSV(`${personName.toLocaleLowerCase("tr-TR").replace(/\s+/g, "-")}-raporu.csv`, csv);
  }

  return (
    <div className="space-y-6">
      <div className="hidden items-start justify-between border-b border-zinc-300 pb-4 print:flex">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            İNTURLAM · KİŞİ RAPORU
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{personName}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {departmentLabel}
            {personTitle ? ` · ${personTitle}` : ""} · {reportLabel}
          </p>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <p>Hazırlanma tarihi</p>
          <p className="mt-1 font-medium text-zinc-800">{generatedAt}</p>
        </div>
      </div>

      <RangeFilterBar rangeKey={rangeKey} customStart={customStart} customEnd={customEnd}>
        <Link
          href={`/tasks?assignee=${encodeURIComponent(personId)}`}
          className="ui-press inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-brand-600 hover:bg-brand-500/10 dark:text-brand-400"
        >
          Görevlerini aç
        </Link>
        <button
          type="button"
          onClick={exportCSV}
          className="ui-press inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-brand-600 hover:bg-brand-500/10 dark:text-brand-400"
        >
          CSV
        </button>
        <ExcelDownloadLink
          rangeKey={rangeKey}
          customStart={customStart}
          customEnd={customEnd}
          personId={personId}
        />
        <PrintButton />
      </RangeFilterBar>

      <section
        aria-label="Rapor özeti"
        className="rounded-2xl border border-brand-200 bg-brand-50/50 p-5 dark:border-brand-900 dark:bg-brand-950/20"
      >
        <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
          Özet
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-200">
          {headlineParts.join(" ")}
        </p>
      </section>

      <section aria-labelledby="person-metrics" className="space-y-3">
        <div>
          <h2 id="person-metrics" className="text-lg font-semibold">
            Rakamlarla {personName}
          </h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Açılan ve tamamlanan seçili döneme ait; açık ve geciken bugünkü durumu gösterir.
          </p>
        </div>
        <div className="report-surface grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-black/10 bg-black/10 dark:border-white/10 dark:bg-white/10 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            label="Dönemde açılan"
            value={summary.opened_tasks}
            note={comparePeriod(summary.opened_tasks, previousSummary?.opened_tasks)}
          />
          <MetricCard
            label="Tamamlanan"
            value={summary.completed_tasks}
            note={`Ekip ortalaması ${teamAverageCompleted.toLocaleString("tr-TR")}`}
            tone="success"
          />
          <MetricCard
            label="Açık iş yükü"
            value={summary.open_tasks}
            note={`Ekip ortalaması ${teamAverageOpen.toLocaleString("tr-TR")}`}
          />
          <MetricCard
            label="Geciken"
            value={summary.overdue_tasks}
            note={summary.overdue_tasks > 0 ? "Teslim tarihi geçmiş" : "Gecikme yok"}
            tone={summary.overdue_tasks > 0 ? "danger" : "success"}
          />
          <MetricCard
            label="Zamanında"
            value={formatRate(summary.on_time_rate)}
            note="Tarihli işlerde teslim başarısı"
            tone="success"
          />
          <MetricCard
            label="Ort. süre"
            value={formatDays(summary.average_cycle_days)}
            note="Açılıştan tamamlanmaya"
          />
        </div>
        {(workloadShare != null || completionShare != null) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {workloadShare != null && (
              <ShareBar
                label="Ekibin açık iş yükündeki payı"
                percentage={workloadShare}
                detail={`${summary.open_tasks} / ${teamSummary.open_tasks} açık görev`}
              />
            )}
            {completionShare != null && (
              <ShareBar
                label="Dönemde tamamlananlardaki payı"
                percentage={completionShare}
                detail={`${summary.completed_tasks} / ${teamSummary.completed_tasks} tamamlanan görev`}
                tone="success"
              />
            )}
          </div>
        )}
      </section>

      <section aria-label="Dağılımlar" className="grid gap-4 xl:grid-cols-2">
        <WorkflowBreakdownPanel
          workflow={workflow}
          description="Kişinin işlerinin şu anda beklediği durum"
          emptyDescription="Bu kişiye atanmış açık görev bulunmuyor."
        />
        <PriorityBreakdownPanel priorities={priorities} />
      </section>

      <TrendChart report={trend} />

      <section aria-label="Süre ve teslim analizi" className="grid gap-4 xl:grid-cols-2">
        <CycleTimePanel report={cycleTime} />
        <DueHealthPanel rows={dueHealth} />
      </section>

      <BrandBreakdownPanel
        brands={brands}
        emptyDescription="Bu kişiye bir markanın işi atandığında dağılım burada görünecek."
      />

      <TaskListPanel
        panelKey="scope-overdue"
        title="Gecikmiş işler"
        description="Teslim tarihi geçmiş, hâlâ açık görevler — en eskisi en üstte"
        count={overdueTasks.length}
        emptyTitle="Gecikmiş iş yok"
        emptyDescription="Teslim tarihi geçmiş açık görev bulunmuyor."
      >
        {overdueTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            trailing={
              <>
                <span className="block font-medium text-danger">
                  {task.due_date ? `${daysBetween(task.due_date, today)} gün` : "—"}
                </span>
                <span className="block text-zinc-500 dark:text-zinc-400">
                  {formatDateShort(task.due_date)}
                </span>
              </>
            }
          />
        ))}
      </TaskListPanel>

      <TaskListPanel
        panelKey="scope-upcoming"
        title={`Önümüzdeki ${upcomingDays} gün`}
        description="Yaklaşan teslim tarihleri"
        count={upcomingTasks.length}
        emptyTitle="Yaklaşan teslim yok"
        emptyDescription={`Önümüzdeki ${upcomingDays} gün içinde teslim tarihi olan açık görev yok.`}
      >
        {upcomingTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            trailing={
              <>
                <span className="block font-medium">
                  {task.due_date === today
                    ? "Bugün"
                    : `${daysBetween(today, task.due_date ?? today)} gün`}
                </span>
                <span className="block text-zinc-500 dark:text-zinc-400">
                  {formatDateShort(task.due_date)}
                </span>
              </>
            }
          />
        ))}
      </TaskListPanel>

      <TaskListPanel
        panelKey="scope-completed"
        title="Son tamamladıkları"
        description="En son kapatılan işler"
        count={completedTasks.length}
        emptyTitle="Henüz tamamlanan iş yok"
        emptyDescription="Bir görev yayınlandığında burada listelenecek."
      >
        {completedTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            trailing={
              <span className="block text-success">
                {formatDateShort(task.completed_at?.slice(0, 10) ?? null)}
              </span>
            }
          />
        ))}
      </TaskListPanel>
    </div>
  );
}
