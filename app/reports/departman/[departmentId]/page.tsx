import Link from "next/link";
import MonthlyPointTargetReport from "@/components/MonthlyPointTargetReport";
import { monthParamISO, monthParamToDate } from "@/lib/date";
import { notFound } from "next/navigation";
import DepartmentReportClient from "@/components/reports/DepartmentReportClient";
import { currentMonthRange, currentWeekRange, todayISO } from "@/lib/date";
import { requireReportAccess } from "@/lib/identity";
import {
  departmentKey,
  departmentLabel,
  isDepartmentId,
  NO_DEPARTMENT,
  type DepartmentKey,
} from "@/lib/departments";
import {
  getCycleTimeReport,
  getReportSummary,
  getTrendReport,
  listBrandBreakdownForScope,
  listDepartmentReport,
  listDueHealthReport,
  listPersonReport,
  listPriorityReport,
  listWorkflowReport,
  type DateRange,
  type DepartmentReportRow,
} from "@/lib/repositories/reports";
import {
  listCompletedTasksByDepartment,
  listOverdueTasksByDepartment,
  listUpcomingTasksByDepartment,
} from "@/lib/repositories/tasks";
import type { RangeKey } from "@/components/ReportsClient";

export const dynamic = "force-dynamic";

const UPCOMING_DAYS = 7;
const RECENT_COMPLETED_LIMIT = 8;

function resolveRange(
  rangeKey: RangeKey,
  customStart: string | undefined,
  customEnd: string | undefined,
): DateRange | null {
  if (rangeKey === "week") return currentWeekRange();
  if (rangeKey === "month") return currentMonthRange();
  if (rangeKey === "custom" && customStart && customEnd) {
    return { start: customStart, end: customEnd };
  }
  return null;
}

function shiftISODate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function previousDateRange(range: DateRange): DateRange {
  const start = new Date(`${range.start}T12:00:00`);
  const end = new Date(`${range.end}T12:00:00`);
  const dayCount = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const previousEnd = shiftISODate(range.start, -1);
  return { start: shiftISODate(previousEnd, -(dayCount - 1)), end: previousEnd };
}

function formatReportDate(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", year: "numeric" })
    .format(new Date(`${value}T12:00:00`));
}

// Hiç kişisi olmayan departmanın `listDepartmentReport`'ta satırı yok.
function emptyTotals(department: DepartmentKey): DepartmentReportRow {
  return {
    department,
    person_count: 0,
    active_person_count: 0,
    total_tasks: 0,
    completed_tasks: 0,
    open_tasks: 0,
    overdue_tasks: 0,
    on_time_rate: null,
    average_cycle_days: null,
  };
}

export default async function DepartmentReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ departmentId: string }>;
  searchParams: Promise<{ range?: string; start?: string; end?: string; month?: string }>;
}) {
  await requireReportAccess();
  const { departmentId } = await params;
  const sp = await searchParams;
  // Bilinmeyen bir departman id'si sessizce "Diğer"e düşmemeli: rapora bakan
  // kişi hangi departmanı okuduğunu bilmeli (kişi raporundaki `notFound()` ile
  // aynı gerekçe).
  if (!isDepartmentId(departmentId) && departmentId !== NO_DEPARTMENT) notFound();
  const department = departmentId as DepartmentKey;
  // `departmentLabel` tanınmayan değer için zaten "Diğer" döndürüyor.
  const label = departmentLabel(department);

  const rangeKey: RangeKey =
    sp.range === "week" || sp.range === "month" || sp.range === "custom"
      ? sp.range
      : "all";
  const range = resolveRange(rangeKey, sp.start, sp.end);
  const today = todayISO();
  const scope = { department };

  const summary = getReportSummary(range, today, scope);
  const previousSummary = range
    ? getReportSummary(previousDateRange(range), today, scope)
    : null;
  // Kıyas ekip ortalamasıyla değil portföy geneliyle: departman zaten bir
  // ekip, "ekip ortalaması" burada kendisiyle kıyas olurdu.
  const portfolioSummary = getReportSummary(range, today);
  const totals =
    listDepartmentReport(range, today).find((row) => row.department === department) ??
    emptyTotals(department);

  const workflow = listWorkflowReport(scope);
  const priorities = listPriorityReport(today, scope);
  const trend = getTrendReport(range, scope);
  const cycleTime = getCycleTimeReport(range, scope);
  const dueHealth = listDueHealthReport(today, scope);
  // Kişi tablosu ayrı bir sorgu istemiyor: portföy kişi raporu departmana göre
  // süzülüyor (pasif kişiler de kalır — geçmiş işleri departmana sayılıyor).
  const members = listPersonReport(range, today).filter(
    (row) => departmentKey(row.department) === department,
  );
  const brands = listBrandBreakdownForScope(range, scope);

  const overdueTasks = listOverdueTasksByDepartment(department, today);
  const upcomingTasks = listUpcomingTasksByDepartment(department, today, UPCOMING_DAYS);
  const completedTasks = listCompletedTasksByDepartment(department, RECENT_COMPLETED_LIMIT);

  const reportLabel = range
    ? `${formatReportDate(range.start)} – ${formatReportDate(range.end)}`
    : "Tüm zamanlar";
  const generatedAt = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  return (
    <div className="report-page space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div className="min-w-0">
          <Link
            href="/reports"
            className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 hover:underline dark:text-brand-400"
          >
            <span aria-hidden="true">←</span> Raporlar
          </Link>
          <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
            {label} departmanı
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
              {totals.person_count} kişi
            </span>
            {department === NO_DEPARTMENT && (
              <span>Departmanı atanmamış kişiler</span>
            )}
          </p>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{reportLabel}</p>
      </div>

      <MonthlyPointTargetReport month={monthParamISO(monthParamToDate(sp.month ?? (range?.start ?? today).slice(0, 7)))} basePath={`/reports/departman/${department}`} department={department} canManage canExport
        preservedQuery={new URLSearchParams({ range: sp.range ?? "all", start: sp.start ?? "", end: sp.end ?? "" }).toString()} />
      <DepartmentReportClient
        departmentId={department}
        departmentLabel={label}
        summary={summary}
        previousSummary={previousSummary}
        portfolioSummary={portfolioSummary}
        totals={totals}
        workflow={workflow}
        priorities={priorities}
        trend={trend}
        cycleTime={cycleTime}
        dueHealth={dueHealth}
        members={members}
        brands={brands}
        overdueTasks={overdueTasks}
        upcomingTasks={upcomingTasks}
        completedTasks={completedTasks}
        upcomingDays={UPCOMING_DAYS}
        rangeKey={rangeKey}
        customStart={sp.start ?? ""}
        customEnd={sp.end ?? ""}
        reportLabel={reportLabel}
        generatedAt={generatedAt}
      />
    </div>
  );
}
