import Link from "next/link";
import ActivityFeed from "@/components/ActivityFeed";
import PersonAvatar from "@/components/PersonAvatar";
import SilentAccountsCard from "@/components/SilentAccountsCard";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import { CONTENT_TYPE_LABEL, TASK_PRIORITY_LABEL } from "@/lib/constants";
import { currentWeekRange, formatDateLong, formatDateShort, todayISO } from "@/lib/date";
import { requirePageSession } from "@/lib/identity";
import { listRecentActivity } from "@/lib/repositories/activity";
import { listBrandsWithOpenCounts } from "@/lib/repositories/brands";
import { getLatestSyncRun, listBrandSocialRows } from "@/lib/repositories/social";
import { listAllTasks, listOverdueTasks, listTasksDueThisWeek, sweepArchivablePublishedTasks } from "@/lib/repositories/tasks";
import { SOCIAL_SILENCE_DAYS } from "@/lib/social";
import { classifySocial } from "@/lib/socialSilence";
import type { IconName } from "@/lib/icons";
import type { ActivityEntry, TaskWithContext } from "@/lib/types";

export const dynamic = "force-dynamic";

const PREVIEW = 7;

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

function TaskRow({ task, overdue }: { task: TaskWithContext; overdue?: boolean }) {
  return (
    <li>
      <Link
        href={`/tasks/${task.id}`}
        className="group grid min-h-[58px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-hover sm:px-5"
      >
        <span className="min-w-0">
          <span className="flex min-w-0 items-center gap-2">
            {overdue && <Icon name="alert" className="size-3.5 text-danger dark:text-rose-400" />}
            <span className="truncate text-[13px] font-semibold text-foreground transition-colors group-hover:text-brand-700 dark:group-hover:text-brand-300">
              {task.title}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-muted">
            {task.brand_name} · {CONTENT_TYPE_LABEL[task.content_type]} · {task.content_title}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2.5">
          {task.priority !== "Normal" && (
            <span className={`hidden rounded-md px-1.5 py-0.5 text-[10px] font-semibold sm:inline ${
              task.priority === "Acil"
                ? "bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200"
                : "bg-rose-100 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300"
            }`}>
              {TASK_PRIORITY_LABEL[task.priority]}
            </span>
          )}
          <span className={`text-[11px] tabular-nums ${overdue ? "font-semibold text-danger dark:text-rose-400" : "text-muted"}`}>
            {formatDateShort(task.due_date)}
          </span>
          {task.assignee_name ? (
            <PersonAvatar name={task.assignee_name} avatarPath={task.assignee_avatar_path} size="xs" />
          ) : (
            <span className="size-5 rounded-full border border-dashed border-border-strong" aria-label="Atanmamış" />
          )}
        </span>
      </Link>
    </li>
  );
}

function TaskPanel({
  id,
  title,
  description,
  tasks,
  overdue,
  emptyText,
}: {
  id: string;
  title: string;
  description: string;
  tasks: TaskWithContext[];
  overdue?: boolean;
  emptyText: string;
}) {
  return (
    <section id={id} className="min-w-0 scroll-mt-24 overflow-hidden rounded-xl border border-border-default bg-surface">
      <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted">{tasks.length}</span>
          </div>
          <p className="mt-1 text-[11px] text-muted">{description}</p>
        </div>
        <Link aria-label="Görevlere git" href="/tasks" className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-[9px] px-2 text-[11px] font-semibold text-brand-600 hover:bg-brand-50 hover:text-brand-700 dark:text-brand-300 dark:hover:bg-brand-950">
          <span className="hidden sm:inline">Görevlere git</span>
          <Icon name="arrow-right" className="size-3.5" />
        </Link>
      </div>
      {tasks.length === 0 ? (
        <div className="flex min-h-36 flex-col items-center justify-center px-4 text-center">
          <span className="grid size-9 place-items-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Icon name="check" className="size-[17px]" />
          </span>
          <p className="mt-3 text-[13px] font-medium text-secondary">{emptyText}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {tasks.slice(0, PREVIEW).map((task) => <TaskRow key={task.id} task={task} overdue={overdue} />)}
        </ul>
      )}
    </section>
  );
}

function ActivityPanel({
  title,
  description,
  entries,
}: {
  title: string;
  description: string;
  entries: ActivityEntry[];
}) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border-default bg-surface">
      <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-4 py-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">{title}</h2>
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted">
              {entries.length}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted">{description}</p>
        </div>
        <Link
          href="/activity"
          className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-[9px] px-2 text-[11px] font-semibold text-brand-600 hover:bg-brand-50 hover:text-brand-700 dark:text-brand-300 dark:hover:bg-brand-950"
        >
          <span className="hidden sm:inline">Tüm hareketler</span>
          <Icon name="arrow-right" className="size-3.5" />
        </Link>
      </div>
      <ActivityFeed entries={entries} emptyText="Henüz kayıtlı bir ekip hareketi yok." />
    </section>
  );
}

export default async function HomePage() {
  const me = await requirePageSession();
  const today = todayISO();
  const weekEnd = currentWeekRange().end;

  sweepArchivablePublishedTasks();

  const brands = listBrandsWithOpenCounts();
  const allTasks = listAllTasks();
  const openTasks = allTasks.filter((task) => task.status !== "Yayinlandi");
  const overdue = listOverdueTasks(today);
  const thisWeek = listTasksDueThisWeek(today, weekEnd);
  const recentActivity = listRecentActivity(3);

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
        description={`${formatDateLong(today)}${me ? ` · ${me.name} için ajans genelinde dikkat isteyen işler.` : " · Ajans genelinde dikkat isteyen işler."}`}
      />

      <section aria-label="Operasyon göstergeleri" className="grid grid-cols-2 divide-x divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-default bg-surface lg:grid-cols-4 lg:divide-y-0">
        <Metric href="/brands" label="Aktif marka" value={brands.length} icon="brands" />
        <Metric href="/tasks" label="Açık görev" value={openTasks.length} icon="tasks" />
        <Metric href="#gecikmis" label="Gecikmiş" value={overdue.length} icon="alert" tone="danger" />
        <Metric href="#bu-hafta" label="Bu hafta" value={thisWeek.length} icon="clock" tone="warning" />
      </section>

      <SilentAccountsCard
        silent={silentAccounts}
        brokenCount={brokenAccounts}
        thresholdDays={SOCIAL_SILENCE_DAYS}
        syncBroken={lastSocialRun?.status === "error"}
      />

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.65fr)]">
        <div className="space-y-5">
          <TaskPanel
            id="gecikmis"
            title="Kritik ve gecikmiş"
            description="Takvim dışına taşan, bugün müdahale edilmesi gereken işler."
            tasks={overdue}
            overdue
            emptyText="Gecikmiş görev yok."
          />
          <ActivityPanel
            title="Ajans akışı"
            description="Ekipte en son değişen görev, içerik, marka ve talepler."
            entries={recentActivity}
          />
        </div>
        <TaskPanel
          id="bu-hafta"
          title="Bu hafta teslim"
          description="Yaklaşan teslimler; ayrıntılı plan Panom ve Görevler'de."
          tasks={thisWeek}
          emptyText="Bu hafta teslim görünmüyor."
        />
      </div>

    </div>
  );
}
