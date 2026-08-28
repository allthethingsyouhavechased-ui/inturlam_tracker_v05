import Link from "next/link";
import { notFound } from "next/navigation";
import PersonAvatar from "@/components/PersonAvatar";
import PersonReportClient, {
  type PersonReportBrandRow,
} from "@/components/reports/PersonReportClient";
import { departmentLabel } from "@/lib/departments";
import { currentMonthRange, currentWeekRange, todayISO } from "@/lib/date";
import { requireReportAccess } from "@/lib/identity";
import { getPerson, listActivePeople } from "@/lib/repositories/people";
import {
  getCycleTimeReport,
  getReportSummary,
  getTrendReport,
  listDueHealthReport,
  listPersonBrandBreakdown,
  listPriorityReport,
  listWorkflowReport,
  type DateRange,
} from "@/lib/repositories/reports";
import {
  listCompletedTasksByAssignee,
  listOverdueTasksByAssignee,
  listUpcomingTasksByAssignee,
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

export default async function PersonReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ personId: string }>;
  searchParams: Promise<{ range?: string; start?: string; end?: string }>;
}) {
  await requireReportAccess();
  const { personId } = await params;
  const sp = await searchParams;
  const person = getPerson(personId);
  if (!person) notFound();

  const rangeKey: RangeKey =
    sp.range === "week" || sp.range === "month" || sp.range === "custom"
      ? sp.range
      : "all";
  const range = resolveRange(rangeKey, sp.start, sp.end);
  const today = todayISO();

  const summary = getReportSummary(range, today, personId);
  const previousSummary = range
    ? getReportSummary(previousDateRange(range), today, personId)
    : null;
  // Karşılaştırma çubuğu için ekip ortalaması: kişinin sayısı tek başına
  // "çok mu az mı" sorusunu cevaplamıyor. Pasif kişiler ortalamayı düşürmesin
  // diye yalnızca aktif ekip sayılıyor.
  const activePeople = listActivePeople();
  const teamSummary = getReportSummary(range, today);
  const teamSize = Math.max(1, activePeople.length);

  const workflow = listWorkflowReport(personId);
  const priorities = listPriorityReport(today, personId);
  const trend = getTrendReport(range, personId);
  const cycleTime = getCycleTimeReport(range, personId);
  const dueHealth = listDueHealthReport(today, personId);
  const brandRows: PersonReportBrandRow[] = listPersonBrandBreakdown(range, personId).map(
    ({ brand_id, brand_name, brand_accent_hue, total_tasks, completed_tasks, open_tasks }) => ({
      brand_id,
      brand_name,
      brand_accent_hue,
      total_tasks,
      completed_tasks,
      open_tasks,
    }),
  );

  const overdueTasks = listOverdueTasksByAssignee(personId, today);
  const upcomingTasks = listUpcomingTasksByAssignee(personId, today, UPCOMING_DAYS);
  const completedTasks = listCompletedTasksByAssignee(personId, RECENT_COMPLETED_LIMIT);

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
        <div className="flex min-w-0 items-center gap-4">
          <PersonAvatar name={person.name} avatarPath={person.avatar_path} size="lg" />
          <div className="min-w-0">
            <Link
              href="/reports"
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-600 hover:underline dark:text-brand-400"
            >
              <span aria-hidden="true">←</span> Raporlar
            </Link>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight">
              {person.name}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
              <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                {departmentLabel(person.department)}
              </span>
              {person.title && <span className="truncate">{person.title}</span>}
              {person.active === 0 && (
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
                  pasif
                </span>
              )}
            </p>
          </div>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{reportLabel}</p>
      </div>

      <PersonReportClient
        personId={person.id}
        personName={person.name}
        departmentLabel={departmentLabel(person.department)}
        personTitle={person.title}
        summary={summary}
        previousSummary={previousSummary}
        teamSummary={teamSummary}
        teamSize={teamSize}
        workflow={workflow}
        priorities={priorities}
        trend={trend}
        cycleTime={cycleTime}
        dueHealth={dueHealth}
        brands={brandRows}
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
