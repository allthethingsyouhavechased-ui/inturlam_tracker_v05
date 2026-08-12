import Link from "next/link";
import HomeBrandProgress from "@/components/HomeBrandProgress";
import SilentAccountsCard from "@/components/SilentAccountsCard";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import { currentWeekRange, formatDateLong, todayISO } from "@/lib/date";
import { requirePageSession } from "@/lib/identity";
import { combineMonthlyProgress } from "@/lib/progress";
import { listPersonBrandAssignments } from "@/lib/repositories/brandAssignments";
import { listBrandsWithOpenCounts } from "@/lib/repositories/brands";
import {
  getPortfolioMonthlyProgress,
  listBrandMonthlyProgress,
  listMonthlyTaskStatusCounts,
  listPersonMonthlyContributions,
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
  tone?: "default" | "danger" | "warning";
}) {
  const valueClass = tone === "danger"
    ? "text-danger dark:text-rose-400"
    : tone === "warning"
      ? "text-warning dark:text-amber-300"
      : "text-foreground";

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

export default async function HomePage() {
  const me = await requirePageSession();
  const today = todayISO();
  const month = today.slice(0, 7);
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
  const portfolioById = new Map(portfolioBrands.map((brand) => [brand.brand_id, brand]));
  const personalContributions = listPersonMonthlyContributions(me.id, month);
  const personalBrands = listPersonBrandAssignments(me.id).flatMap((assignment) => {
    const brand = portfolioById.get(assignment.brand_id);
    if (!brand) return [];
    const tasks = personalContributions.filter((task) => task.brand_id === assignment.brand_id);
    return [{
      ...brand,
      personal_task_count: tasks.length,
      personal_points: Number(tasks.reduce((sum, task) => sum + task.contribution_points, 0).toFixed(2)),
    }];
  });
  const assignedBrandsProgress = combineMonthlyProgress(
    month,
    personalBrands.map((brand) => brand.progress),
  );

  const socialHealth = listBrandSocialRows().map((row) => ({
    row,
    health: classifySocial(row, SOCIAL_SILENCE_DAYS, today),
  }));
  const silentAccounts = socialHealth.filter((item) => item.health === "silent").map((item) => item.row);
  const brokenAccounts = socialHealth.filter((item) => item.health === "error" || item.health === "unknown").length;
  const lastSocialRun = getLatestSyncRun();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="OPERASYON ÖZETİ"
        title="Bugün"
        description={`${formatDateLong(today)} · ${me.name} için kişisel marka odağı ve ajans portföyünün aylık ilerlemesi.`}
      />

      <section aria-label="Operasyon göstergeleri" className="grid grid-cols-2 divide-x divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-default bg-surface lg:grid-cols-4 lg:divide-y-0">
        <Metric href="/brands" label="Aktif marka" value={brands.length} icon="brands" />
        <Metric href="/tasks" label="Açık görev" value={openTasks.length} icon="tasks" />
        <Metric href="/tasks" label="Gecikmiş" value={overdue.length} icon="alert" tone="danger" />
        <Metric href="/tasks" label="Bu hafta" value={thisWeek.length} icon="clock" tone="warning" />
      </section>

      <SilentAccountsCard
        silent={silentAccounts}
        brokenCount={brokenAccounts}
        thresholdDays={SOCIAL_SILENCE_DAYS}
        syncBroken={lastSocialRun?.status === "error"}
      />

      <HomeBrandProgress
        personalBrands={personalBrands}
        assignedBrandsProgress={assignedBrandsProgress}
        portfolioBrands={portfolioBrands}
        portfolioProgress={portfolioProgress}
        portfolioStatusCounts={portfolioStatusCounts}
      />
    </div>
  );
}
