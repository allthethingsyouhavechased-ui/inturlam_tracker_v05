"use client";

// Departman raporu (/reports/departman/[departmentId]).
//
// Kişi raporuyla aynı sorguları kullanır, sadece kapsam `{ department }`
// (bkz. lib/repositories/reports.ts → ReportScope). Kişi raporundan farkı:
// kıyas ekip ortalamasıyla değil PORTFÖY GENELİYLE yapılır ve raporun ortasında
// departmanın kendi kişi tablosu vardır — "departmanın yükü kimde" sorusu
// yalnızca burada cevaplanabiliyor.

import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import PersonAvatar from "@/components/PersonAvatar";
import CollapsiblePanel from "@/components/reports/CollapsiblePanel";
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
import type { DepartmentKey } from "@/lib/departments";
import type {
  BrandBreakdownRow,
  CycleTimeReport,
  DepartmentReportRow,
  DueHealthRow,
  PersonReportRow,
  PriorityReportRow,
  ReportSummary,
  TrendReport,
  WorkflowReportRow,
} from "@/lib/repositories/reports";
import type { TaskWithContext } from "@/lib/types";

export default function DepartmentReportClient({
  departmentId,
  departmentLabel,
  summary,
  previousSummary,
  portfolioSummary,
  totals,
  workflow,
  priorities,
  trend,
  cycleTime,
  dueHealth,
  members,
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
  departmentId: DepartmentKey;
  departmentLabel: string;
  summary: ReportSummary;
  previousSummary: ReportSummary | null;
  portfolioSummary: ReportSummary;
  totals: DepartmentReportRow;
  workflow: WorkflowReportRow[];
  priorities: PriorityReportRow[];
  trend: TrendReport;
  cycleTime: CycleTimeReport;
  dueHealth: DueHealthRow[];
  members: PersonReportRow[];
  brands: BrandBreakdownRow[];
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
  const maxMemberOpen = Math.max(1, ...members.map((member) => member.open_tasks));

  const workloadShare =
    portfolioSummary.open_tasks === 0
      ? null
      : Math.round((summary.open_tasks / portfolioSummary.open_tasks) * 100);
  const completionShare =
    portfolioSummary.completed_tasks === 0
      ? null
      : Math.round((summary.completed_tasks / portfolioSummary.completed_tasks) * 100);
  // Kişi başına düşen yük: 2 kişilik departmanın 10 açık işi ile 6 kişilik
  // departmanın 10 açık işi aynı şey değil.
  const perPersonOpen =
    totals.active_person_count === 0
      ? null
      : Math.round((summary.open_tasks / totals.active_person_count) * 10) / 10;

  const headlineParts: string[] = [
    `${departmentLabel} departmanı seçili dönemde ${summary.completed_tasks} iş tamamladı ve şu anda ${summary.open_tasks} açık işi var.`,
  ];
  if (totals.person_count > 0) {
    headlineParts.push(
      `Departmanda ${totals.person_count} kişi kayıtlı${
        totals.active_person_count !== totals.person_count
          ? ` (${totals.active_person_count} aktif)`
          : ""
      }${perPersonOpen != null ? `, kişi başına ${perPersonOpen.toLocaleString("tr-TR")} açık iş düşüyor` : ""}.`,
    );
  }
  if (summary.overdue_tasks > 0) {
    headlineParts.push(
      `${summary.overdue_tasks} işin teslim tarihi geçmiş — önce buraya bakılmalı.`,
    );
  } else if (summary.open_tasks > 0) {
    headlineParts.push("Gecikmiş işi yok, teslim görünümü sağlıklı.");
  }
  // Yüzdeye Türkçe iyelik eki getirmekten kaçınılıyor (bkz. PersonReportClient).
  if (summary.on_time_rate != null) {
    headlineParts.push(
      `Teslim tarihi olan işlerde zamanında tamamlama oranı %${Math.round(summary.on_time_rate)}.`,
    );
  }
  if (workloadShare != null && summary.open_tasks > 0) {
    headlineParts.push(`Portföydeki toplam açık iş yükünün %${workloadShare} kadarı burada.`);
  }

  function exportCSV() {
    const rows = [
      { metric: "Departman", value: departmentLabel },
      { metric: "Dönem", value: reportLabel },
      { metric: "Kişi sayısı", value: String(totals.person_count) },
      { metric: "Aktif kişi sayısı", value: String(totals.active_person_count) },
      { metric: "Dönemde açılan", value: String(summary.opened_tasks) },
      { metric: "Dönemde tamamlanan", value: String(summary.completed_tasks) },
      { metric: "Açık iş yükü", value: String(summary.open_tasks) },
      { metric: "Gecikmiş", value: String(summary.overdue_tasks) },
      { metric: "Zamanında tamamlama", value: formatRate(summary.on_time_rate) },
      { metric: "Ortalama tamamlanma süresi", value: formatDays(summary.average_cycle_days) },
      {
        metric: "Portföydeki açık iş payı",
        value: workloadShare == null ? "—" : `%${workloadShare}`,
      },
      ...members.map((member) => ({
        metric: `Kişi — ${member.person_name}`,
        value: `${member.completed_tasks} tamamlanan / ${member.open_tasks} açık / ${member.overdue_tasks} geciken`,
      })),
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
        metric: `Gecikmiş görev — ${task.assignee_name ?? "Atanmamış"}`,
        value: `${task.title} (${task.brand_name}, ${formatDateShort(task.due_date)})`,
      })),
    ];
    const csv = toCSV(rows, [
      { key: "metric", label: "Başlık" },
      { key: "value", label: "Değer" },
    ]);
    downloadCSV(
      `${departmentLabel.toLocaleLowerCase("tr-TR").replace(/\s+/g, "-")}-departman-raporu.csv`,
      csv,
    );
  }

  return (
    <div className="space-y-6">
      <div className="hidden items-start justify-between border-b border-zinc-300 pb-4 print:flex">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
            İNTURLAM · DEPARTMAN RAPORU
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{departmentLabel}</h1>
          <p className="mt-1 text-sm text-zinc-600">
            {totals.person_count} kişi · {reportLabel}
          </p>
        </div>
        <div className="text-right text-xs text-zinc-500">
          <p>Hazırlanma tarihi</p>
          <p className="mt-1 font-medium text-zinc-800">{generatedAt}</p>
        </div>
      </div>

      <RangeFilterBar rangeKey={rangeKey} customStart={customStart} customEnd={customEnd}>
        <Link
          href={`/tasks?department=${encodeURIComponent(departmentId)}`}
          className="ui-press inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-medium text-brand-600 hover:bg-brand-500/10 dark:text-brand-400"
        >
          Görevleri aç
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
          departmentId={departmentId}
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

      <section aria-labelledby="department-metrics" className="space-y-3">
        <div>
          <h2 id="department-metrics" className="text-lg font-semibold">
            Rakamlarla {departmentLabel}
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
            note={comparePeriod(summary.completed_tasks, previousSummary?.completed_tasks)}
            tone="success"
          />
          <MetricCard
            label="Açık iş yükü"
            value={summary.open_tasks}
            note={
              perPersonOpen == null
                ? "Aktif kişi yok"
                : `Kişi başına ${perPersonOpen.toLocaleString("tr-TR")} iş`
            }
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
                label="Portföyün açık iş yükündeki payı"
                percentage={workloadShare}
                detail={`${summary.open_tasks} / ${portfolioSummary.open_tasks} açık görev`}
              />
            )}
            {completionShare != null && (
              <ShareBar
                label="Dönemde tamamlananlardaki payı"
                percentage={completionShare}
                detail={`${summary.completed_tasks} / ${portfolioSummary.completed_tasks} tamamlanan görev`}
                tone="success"
              />
            )}
          </div>
        )}
      </section>

      <CollapsiblePanel
        panelKey="department-members"
        title="Departmandaki kişiler"
        description="Yükün kimde olduğu — satır sonundaki bağlantı kişinin kendi raporunu açar"
        meta={<span className="tabular-nums">{members.length} kişi</span>}
      >
        {members.length === 0 ? (
          <EmptyState
            compact
            title="Bu departmanda kişi yok"
            description="Ekip sayfasından kişilerin departmanını atayabilirsin."
          />
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-zinc-50/90 dark:bg-zinc-950/70">
                <tr className="border-y border-black/10 text-left text-xs uppercase tracking-wider text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                  <th className="px-5 py-3 font-medium">Kişi</th>
                  <th className="px-3 py-3 font-medium">Açılan</th>
                  <th className="px-3 py-3 font-medium">Tamamlanan</th>
                  <th className="px-3 py-3 font-medium">Açık</th>
                  <th className="px-3 py-3 font-medium">Geciken</th>
                  <th className="px-3 py-3 font-medium">Zamanında</th>
                  <th className="px-3 py-3 font-medium print:hidden">
                    <span className="sr-only">Kişi raporu</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr
                    key={member.person_id}
                    className="border-b border-black/5 last:border-0 dark:border-white/5"
                  >
                    <td className="px-5 py-3">
                      <span className="flex min-w-0 items-center gap-2">
                        <PersonAvatar
                          name={member.person_name}
                          avatarPath={member.avatar_path}
                          size="sm"
                        />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {member.person_name}
                          </span>
                          {member.active === 0 && (
                            <span className="block text-[10px] text-zinc-500 dark:text-zinc-400">
                              pasif
                            </span>
                          )}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{member.total_tasks}</td>
                    <td className="px-3 py-3 font-medium tabular-nums">
                      {member.completed_tasks}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      <div className="flex items-center gap-2">
                        <span className="min-w-4">{member.open_tasks}</span>
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                          <span
                            className="block h-full rounded-full bg-brand-500"
                            style={{ width: `${(member.open_tasks / maxMemberOpen) * 100}%` }}
                          />
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      <span
                        className={
                          member.overdue_tasks > 0
                            ? "font-medium text-danger"
                            : undefined
                        }
                      >
                        {member.overdue_tasks}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{formatRate(member.on_time_rate)}</td>
                    <td className="px-3 py-3 print:hidden">
                      <Link
                        href={`/reports/kisi/${encodeURIComponent(member.person_id)}`}
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
        )}
      </CollapsiblePanel>

      <section aria-label="Dağılımlar" className="grid gap-4 xl:grid-cols-2">
        <WorkflowBreakdownPanel
          workflow={workflow}
          description="Departmanın işlerinin şu anda beklediği durum"
          emptyDescription="Bu departmandaki kişilere atanmış açık görev bulunmuyor."
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
        emptyDescription="Departmana bir markanın işi atandığında dağılım burada görünecek."
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
            showAssignee
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
            showAssignee
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
        title="Son tamamlananlar"
        description="Departmanda en son kapatılan işler"
        count={completedTasks.length}
        emptyTitle="Henüz tamamlanan iş yok"
        emptyDescription="Bir görev yayınlandığında burada listelenecek."
      >
        {completedTasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            showAssignee
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
