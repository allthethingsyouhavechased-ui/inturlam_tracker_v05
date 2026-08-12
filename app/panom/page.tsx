import Link from "next/link";
import { cookies } from "next/headers";
import AutoRefresh from "@/components/AutoRefresh";
import PanomViews from "@/components/PanomViews";
import PersonalDeadlineRadar from "@/components/PersonalDeadlineRadar";
import PageHeader from "@/components/ui/PageHeader";
import { currentWeekRange, todayISO } from "@/lib/date";
import { TASK_STATUS_LABEL } from "@/lib/constants";
import { requirePageSession } from "@/lib/identity";
import { listPersonBrandAssignments } from "@/lib/repositories/brandAssignments";
import { getBrandMonthlyProgress, getPersonMonthlyProgress, listPersonMonthlyContributions } from "@/lib/repositories/progress";
import { listUnreadTaskIdsForPerson } from "@/lib/repositories/notifications";
import { listPersonalTaskTargets } from "@/lib/repositories/personalTargets";
import { listActivePeople } from "@/lib/repositories/people";
import {
  listBoardTasksByAssignee,
  listOverdueTasks,
  listTasksDueThisWeek,
  sweepArchivablePublishedTasks,
} from "@/lib/repositories/tasks";
import { archiveCountdownBadge } from "@/lib/taskArchive";
import { PANOM_VIEW_PREFERENCE, parseWorkspaceView } from "@/lib/uiPreferences";
import type { TaskCardBadge, TaskWithContext, TaskWithPersonalTarget } from "@/lib/types";

export const dynamic = "force-dynamic";

const PERSONAL_DEADLINE_HORIZON_DAYS = 7;

const BADGE_OVERDUE: TaskCardBadge = {
  label: "Gecikmiş",
  className: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};
const BADGE_THIS_WEEK: TaskCardBadge = {
  label: "Bu hafta",
  className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};
const BADGE_UPDATED: TaskCardBadge = {
  label: "Güncellendi",
  className: "bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300",
};

export default async function PanomPage() {
  const me = await requirePageSession();
  const cookieStore = await cookies();
  const initialView = parseWorkspaceView(
    cookieStore.get(PANOM_VIEW_PREFERENCE.cookie)?.value,
  );
  const today = todayISO();
  const month = today.slice(0, 7);
  const weekEnd = currentWeekRange().end;

  sweepArchivablePublishedTasks();

  const myTasks = listBoardTasksByAssignee(me.id);
  const overdue = listOverdueTasks(today);
  const thisWeek = listTasksDueThisWeek(today, weekEnd);
  const personalTargets = listPersonalTaskTargets(me.id);
  const targetByTask = new Map(
    personalTargets.map((target) => [target.task_id, target.target_date]),
  );
  const myPlanningTasks: TaskWithPersonalTarget[] = myTasks
    .filter((task) => task.status !== "Yayinlandi")
    .map((task) => ({
      ...task,
      personal_target_date: targetByTask.get(task.id) ?? null,
    }));
  const people = listActivePeople();
  const assignedBrands = listPersonBrandAssignments(me.id);
  const assignedBrandProgress = assignedBrands.map((brand) => ({
    ...brand,
    progress: getBrandMonthlyProgress(brand.brand_id, month),
  }));
  const monthlyProgress = getPersonMonthlyProgress(me.id, month);
  const contributions = listPersonMonthlyContributions(me.id, month);

  const myIds = new Set(myTasks.map((task) => task.id));
  const overdueIds = new Set(overdue.map((task) => task.id));
  const thisWeekIds = new Set(thisWeek.map((task) => task.id));
  const updatedIds = listUnreadTaskIdsForPerson(me.id);

  function badgesFor(task: TaskWithContext): TaskCardBadge[] {
    const badges: TaskCardBadge[] = [];
    if (updatedIds.has(task.id)) badges.push(BADGE_UPDATED);
    if (overdueIds.has(task.id)) badges.push(BADGE_OVERDUE);
    if (thisWeekIds.has(task.id)) badges.push(BADGE_THIS_WEEK);
    const countdown = archiveCountdownBadge(task);
    if (countdown) badges.push(countdown);
    return badges;
  }

  const myBoardTasks: TaskWithContext[] = myTasks.map((task) => ({
    ...task,
    badges: badgesFor(task),
    personal_target_date: targetByTask.get(task.id) ?? null,
  }));

  const othersMap = new Map<string, TaskWithContext>();
  for (const task of [...overdue, ...thisWeek]) {
    if (myIds.has(task.id)) continue;
    othersMap.set(task.id, { ...task, badges: badgesFor(task) });
  }
  const otherTasks = [...othersMap.values()].sort((a, b) =>
    (a.due_date ?? "").localeCompare(b.due_date ?? ""),
  );

  return (
    <div className="relative">
      <AutoRefresh />
      <PageHeader
        eyebrow="KİŞİSEL ÇALIŞMA ALANI"
        title="Panom"
        description={
          me
            ? `${me.name} için atanmış işler, kişisel hedefler ve yaklaşan riskler.`
            : "Kişisel görev akışını görmek için çalışma kimliğini seç."
        }
      />

      <section className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="rounded-xl border border-border-default bg-surface p-4">
          <p className="text-[11px] font-semibold tracking-[0.08em] text-muted">ÜZERİMDEKİ MARKALAR</p>
          {assignedBrandProgress.length > 0 ? (
            <div className="mt-3 divide-y divide-border-subtle">
              {assignedBrandProgress.map((brand) => (
                <Link key={brand.brand_id} href={`/brands/${brand.brand_id}`} className="group block py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-300">{brand.brand_name}</span><span className="shrink-0 tabular-nums text-muted">{brand.progress.percent === null ? "Bu ay plan yok" : `%${brand.progress.percent}`}</span></div>
                  {brand.progress.percent !== null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-subtle"><div className="h-full rounded-full bg-brand-600" style={{ width: `${brand.progress.percent}%` }} /></div>}
                </Link>
              ))}
            </div>
          ) : <p className="mt-3 text-sm text-muted">Henüz marka ataması yapılmadı.</p>}
        </div>
        <div className="rounded-xl border border-border-default bg-surface p-4">
          <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold tracking-[0.08em] text-muted">BU AYKİ KATKIM</p><p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{monthlyProgress.percent === null ? "Bu ay plan yok" : `%${monthlyProgress.percent}`}</p></div>{monthlyProgress.percent !== null && <span className="text-xs text-muted">{monthlyProgress.weighted_earned}/{monthlyProgress.weighted_total} puan</span>}</div>
          {monthlyProgress.percent !== null && <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-subtle"><div className="h-full rounded-full bg-brand-600" style={{ width: `${monthlyProgress.percent}%` }} /></div>}
          {contributions.length > 0 && <div className="mt-4 max-h-36 space-y-2 overflow-y-auto border-t border-border-subtle pt-3">{contributions.map((task) => <Link key={task.id} href={`/tasks/${task.id}`} className="flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate text-secondary">{task.brand_name} · {task.title}</span><span className="shrink-0 text-muted">{TASK_STATUS_LABEL[task.status]} · {task.contribution_points}/{task.weight_points}</span></Link>)}</div>}
        </div>
      </section>

      {!me && (
        <section className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-default bg-surface px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Kişisel panon henüz bağlı değil</h2>
            <p className="mt-1 text-xs text-muted">Kimliğini seçtiğinde yalnız sana atanmış işler burada görünür.</p>
          </div>
          <Link
            href="/whoami"
            className="ui-press inline-flex min-h-10 items-center rounded-[10px] bg-brand-600 px-3.5 text-sm font-semibold text-white hover:bg-brand-500"
          >
            Kimliğimi seç
          </Link>
        </section>
      )}

      {me && (
        <PersonalDeadlineRadar
          personId={me.id}
          tasks={myPlanningTasks}
          today={today}
          horizonDays={PERSONAL_DEADLINE_HORIZON_DAYS}
          headerAction
        />
      )}

      <PanomViews
        myTasks={myBoardTasks}
        otherTasks={otherTasks}
        people={people}
        hasIdentity={Boolean(me)}
        initialView={initialView}
      />
    </div>
  );
}
