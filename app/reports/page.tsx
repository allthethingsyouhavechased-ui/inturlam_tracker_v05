import ReportsClient, {
  type BrandReportView,
  type PersonReportView,
  type RangeKey,
} from "@/components/ReportsClient";
import PageHeader from "@/components/ui/PageHeader";
import MonthlyPointTargetReport from "@/components/MonthlyPointTargetReport";
import { monthParamISO, monthParamToDate } from "@/lib/date";
import { currentMonthRange, currentWeekRange, todayISO } from "@/lib/date";
import { withAllDepartments } from "@/lib/departments";
import { requireReportAccess } from "@/lib/identity";
import {
  getCycleTimeReport,
  getDeliveryQualityReport,
  getReportSummary,
  getTrendReport,
  listBrandPersonBreakdown,
  listBrandReport,
  listDepartmentReport,
  listDueHealthReport,
  listPersonBrandBreakdown,
  listPersonReport,
  listWorkflowReport,
  type DateRange,
} from "@/lib/repositories/reports";
import { listTeamMonthlyProgress } from "@/lib/repositories/progress";

export const dynamic = "force-dynamic";

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

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; start?: string; end?: string; month?: string }>;
}) {
  await requireReportAccess();
  const sp = await searchParams;
  const rangeKey: RangeKey =
    sp.range === "week" || sp.range === "month" || sp.range === "custom"
      ? sp.range
      : "all";
  const range = resolveRange(rangeKey, sp.start, sp.end);
  const today = todayISO();
  const teamMonthlyProgress = listTeamMonthlyProgress(today.slice(0, 7));

  const summary = getReportSummary(range, today);
  const previousSummary = range ? getReportSummary(previousDateRange(range), today) : null;
  const workflow = listWorkflowReport();
  const trend = getTrendReport(range);
  const cycleTime = getCycleTimeReport(range);
  const deliveryQuality = getDeliveryQualityReport(range);
  const dueHealth = listDueHealthReport(today);
  // Departmanı olan/olmayan herkesin satırı sabit sırada; o dönemde hiç işi
  // olmayan departman da sıfır satırıyla görünsün diye zenginleştiriliyor.
  const departmentRows = withAllDepartments(listDepartmentReport(range, today), (department) => ({
    department,
    person_count: 0,
    active_person_count: 0,
    total_tasks: 0,
    completed_tasks: 0,
    open_tasks: 0,
    overdue_tasks: 0,
    on_time_rate: null,
    average_cycle_days: null,
  }));
  const personRows = listPersonReport(range, today);
  const personBrandRows = listPersonBrandBreakdown(range);
  const brandRows = listBrandReport(range, today);
  const brandPersonRows = listBrandPersonBreakdown(range);

  const personViews: PersonReportView[] = personRows.map((p) => ({
    ...p,
    brands: personBrandRows
      .filter((b) => b.person_id === p.person_id)
      .map(({ brand_id, brand_name, brand_accent_hue, total_tasks, completed_tasks, open_tasks }) => ({
        brand_id,
        brand_name,
        brand_accent_hue,
        total_tasks,
        completed_tasks,
        open_tasks,
      })),
  }));

  const brandViews: BrandReportView[] = brandRows.map((b) => ({
    ...b,
    people: brandPersonRows
      .filter((p) => p.brand_id === b.brand_id)
      .map(({ person_id, person_name, total_tasks, completed_tasks, open_tasks }) => ({
        person_id,
        person_name,
        total_tasks,
        completed_tasks,
        open_tasks,
      })),
  }));

  const reportLabel = range
    ? `${formatReportDate(range.start)} – ${formatReportDate(range.end)}`
    : "Tüm zamanlar";
  const generatedAt = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date());

  return (
    <div className="report-page">
      <PageHeader
        eyebrow="OPERASYON ANALİTİĞİ"
        title="Raporlar"
        description="İş yükünü, teslim sağlığını, çevrim süresini ve ekip performansını karşılaştır."
        actions={<p className="text-xs font-semibold text-secondary">{reportLabel}</p>}
        className="print:hidden"
      />
      <ReportsClient
        summary={summary}
        previousSummary={previousSummary}
        workflow={workflow}
        trend={trend}
        cycleTime={cycleTime}
        deliveryQuality={deliveryQuality}
        dueHealth={dueHealth}
        departments={departmentRows}
        people={personViews}
        brands={brandViews}
        rangeKey={rangeKey}
        customStart={sp.start ?? ""}
        customEnd={sp.end ?? ""}
        reportLabel={reportLabel}
        generatedAt={generatedAt}
        teamMonthlyProgress={teamMonthlyProgress}
      />
      <MonthlyPointTargetReport month={monthParamISO(monthParamToDate(sp.month ?? (range?.start ?? today).slice(0, 7)))} basePath="/reports" canManage canExport
        preservedQuery={new URLSearchParams({ range: sp.range ?? "all", start: sp.start ?? "", end: sp.end ?? "" }).toString()} />
    </div>
  );
}
