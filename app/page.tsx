import Link from "next/link";
import { getPersonPointTargetProgress } from "@/lib/repositories/monthlyPointTargets";
import HomeBrandProgress from "@/components/HomeBrandProgress";
import HomeFocusPanel from "@/components/HomeFocusPanel";
import MonthNavigator from "@/components/MonthNavigator";
import SilentAccountsCard from "@/components/SilentAccountsCard";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import {
  currentWeekRange,
  formatDateLong,
  formatMonthLabel,
  monthParamISO,
  monthParamToDate,
  todayISO,
} from "@/lib/date";
import { requirePageSession } from "@/lib/identity";
import { listPersonBrandAssignments } from "@/lib/repositories/brandAssignments";
import { listBrandsWithOpenCounts } from "@/lib/repositories/brands";
import {
  getPortfolioMonthlyProgress,
  listBrandMonthlyProgress,
  listMonthlyTaskStatusCounts,
} from "@/lib/repositories/progress";
import { getLatestSyncRun, listBrandSocialRows } from "@/lib/repositories/social";
import {
  listAllTasks,
  listOverdueTasks,
  listTasksDueThisWeek,
  sweepArchivablePublishedTasks,
} from "@/lib/repositories/tasks";
import { SOCIAL_SILENCE_DAYS } from "@/lib/social";
import { classifySocial } from "@/lib/socialSilence";
import type { IconName } from "@/lib/icons";

export const dynamic = "force-dynamic";

function Metric({
  href,
  label,
  value,
  icon,
  tone = "default",
}: {
  href: string;
  label: string;
  value: number;
  icon: IconName;
  tone?: "default" | "brand" | "info" | "danger" | "warning";
}) {
  const valueClass = {
    default: "text-foreground",
    brand: "text-brand-600 dark:text-brand-300",
    info: "text-info",
    danger: "text-danger",
    warning: "text-warning",
  }[tone];

  return (
    <Link href={href} className="group flex min-w-0 items-center gap-3 px-3 py-4 hover:bg-surface-hover sm:px-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-border-subtle bg-surface text-muted transition-colors group-hover:border-border-default group-hover:text-foreground">
        <Icon name={icon} className="size-[18px]" />
      </span>
      <span className="min-w-0">
        <span className={`block text-xl font-semibold tabular-nums tracking-[-0.025em] ${valueClass}`}>{value}</span>
        <span className="block truncate text-[11px] font-medium text-muted">{label}</span>
      </span>
    </Link>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const me = await requirePageSession();
  const sp = await searchParams;
  const today = todayISO();
  const monthDate = monthParamToDate(sp.month);
  const month = monthParamISO(monthDate);
  const monthLabel = formatMonthLabel(monthDate);
  const weekEnd = currentWeekRange().end;

  sweepArchivablePublishedTasks();

  const brands = listBrandsWithOpenCounts();
  const allTasks = listAllTasks();
  const openTasks = allTasks.filter((task) => task.status !== "Yayinlandi");
  const overdue = listOverdueTasks(today);
  const thisWeek = listTasksDueThisWeek(today, weekEnd);

  const portfolioBrands = listBrandMonthlyProgress(month);
  const portfolioProgress = getPortfolioMonthlyProgress(month);
  const portfolioStatusCounts = listMonthlyTaskStatusCounts(month);
  const personalProgress = getPersonPointTargetProgress(me.id, month);
  const assignedBrandIds = listPersonBrandAssignments(me.id).map((assignment) => assignment.brand_id);
  const personalDeadlines = openTasks
    .filter((task) => (
      task.assignee_id === me.id
      && (task.status === "Beklemede" || task.status === "DevamEdiyor")
      && task.due_date !== null
      && task.due_date <= weekEnd
    ))
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const revisionTasks = allTasks
    .filter((task) => task.active_revision_id !== null && task.assignee_id === me.id)
    .sort((a, b) => {
      const aOver = (a.active_revision_elapsed_minutes ?? 0) > (a.active_revision_target_minutes ?? Infinity);
      const bOver = (b.active_revision_elapsed_minutes ?? 0) > (b.active_revision_target_minutes ?? Infinity);
      return Number(bOver) - Number(aOver) || (b.active_revision_elapsed_minutes ?? 0) - (a.active_revision_elapsed_minutes ?? 0);
    });
  const reviewTasks = allTasks
    .filter((task) => task.status === "Incelemede" && task.assignee_id === me.id)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));

  const socialHealth = listBrandSocialRows().map((row) => ({
    row,
    health: classifySocial(row, SOCIAL_SILENCE_DAYS, today),
  }));
  const silentAccounts = socialHealth.filter((item) => item.health === "silent").map((item) => item.row);
  const brokenAccounts = socialHealth.filter((item) => item.health === "error" || item.health === "unknown").length;
  const lastSocialRun = getLatestSyncRun();

  return (
    <div>
      <PageHeader
        eyebrow="OPERASYON ÖZETİ"
        title="Bugün"
        description={`${formatDateLong(today)} · Güncel operasyon metrikleri ve ${monthLabel} marka ilerlemesi.`}
        actions={<MonthNavigator month={month} basePath="/" ariaLabel="Ana sayfa analiz ayı" />}
      />

      <div className="space-y-6">
      <HomeBrandProgress
        month={month}
        portfolioBrands={portfolioBrands}
        portfolioProgress={portfolioProgress}
        portfolioStatusCounts={portfolioStatusCounts}
        personalProgress={personalProgress}
        assignedBrandIds={assignedBrandIds}
        section="summary"
      />

      <HomeFocusPanel
        personalDeadlines={personalDeadlines}
        revisionTasks={revisionTasks}
        reviewTasks={reviewTasks}
      />

      <section aria-label="Operasyon göstergeleri" className="grid grid-cols-2 divide-x divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-default bg-surface lg:grid-cols-4 lg:divide-y-0">
        <Metric href="/brands" label="Aktif marka" value={brands.length} icon="brands" tone="brand" />
        <Metric href="/tasks?focus=open" label="Açık görev" value={openTasks.length} icon="tasks" tone="info" />
        <Metric href="/tasks?focus=overdue" label="Gecikmiş" value={overdue.length} icon="alert" tone="danger" />
        <Metric href="/tasks?focus=week" label="Bu hafta" value={thisWeek.length} icon="clock" tone="warning" />
      </section>

      <SilentAccountsCard
        silent={silentAccounts}
        brokenCount={brokenAccounts}
        thresholdDays={SOCIAL_SILENCE_DAYS}
        syncBroken={lastSocialRun?.status === "error"}
      />

      <HomeBrandProgress
        month={month}
        portfolioBrands={portfolioBrands}
        portfolioProgress={portfolioProgress}
        portfolioStatusCounts={portfolioStatusCounts}
        personalProgress={personalProgress}
        assignedBrandIds={assignedBrandIds}
        section="details"
      />
      </div>
    </div>
  );
}
