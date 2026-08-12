import Link from "next/link";
import { cookies } from "next/headers";
import AutoRefresh from "@/components/AutoRefresh";
import PanomViews from "@/components/PanomViews";
import PersonalDeadlineRadar from "@/components/PersonalDeadlineRadar";
import PageHeader from "@/components/ui/PageHeader";
import { currentWeekRange, todayISO } from "@/lib/date";
import { requirePageSession } from "@/lib/identity";
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
