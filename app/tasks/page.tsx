import AutoRefresh from "@/components/AutoRefresh";
import { cookies } from "next/headers";
import Link from "next/link";
import TaskExplorer from "@/components/TaskExplorer";
import TaskPlanningQueue from "@/components/TaskPlanningQueue";
import PageHeader from "@/components/ui/PageHeader";
import Icon from "@/components/ui/Icon";
import { currentWeekRange, todayISO } from "@/lib/date";
import { isDepartmentId, NO_DEPARTMENT } from "@/lib/departments";
import { requirePageSession } from "@/lib/identity";
import { listBrands } from "@/lib/repositories/brands";
import { listPersonalTaskTargets } from "@/lib/repositories/personalTargets";
import { listActivePeople } from "@/lib/repositories/people";
import { listAllTasks, sweepArchivablePublishedTasks } from "@/lib/repositories/tasks";
import { listLegacyUndatedTasks, listUnplannedGuestTasks } from "@/lib/repositories/guestTasks";
import { archiveCountdownBadge } from "@/lib/taskArchive";
import { parseTaskFocus } from "@/lib/taskFocus";
import { TASKS_VIEW_PREFERENCE, parseWorkspaceView } from "@/lib/uiPreferences";

export const dynamic = "force-dynamic";

// Filtreler istemci state'inde tutuluyor; URL yalnızca BAŞLANGIÇ değerini
// veriyor (rapor sayfasından "Görevlerini aç" / "Ekibin görevleri" linkleri).
// Kullanıcı sonrasında filtreyi değiştirdiğinde URL güncellenmiyor — bilinçli:
// her tıklamada sunucu render'ı tetiklemek listeyi yavaşlatırdı.
export default async function AllTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ assignee?: string; department?: string; focus?: string }>;
}) {
  const me = await requirePageSession();
  const sp = await searchParams;
  const cookieStore = await cookies();
  const initialView = parseWorkspaceView(
    cookieStore.get(TASKS_VIEW_PREFERENCE.cookie)?.value,
  );
  // Okumadan ÖNCE süpür, yoksa süresi dolmuş işler bu render'da bir kez daha
  // arşivlenmemiş görünürdü.
  sweepArchivablePublishedTasks();
  // Arşiv de indiriliyor (`true`): "Arşivi göster" düğmesi sayfadaki diğer
  // filtreler gibi tamamen istemci tarafında çalışsın, tıklayınca sunucuya
  // gidilmesin diye.
  // Geri sayım rozeti SUNUCUDA iliştiriliyor (bkz. `archiveCountdownBadge`):
  // kart bileşeni istemci tarafında, orada `new Date()` çağırmak gün sınırında
  // hydration uyuşmazlığı üretebilirdi.
  const targetByTask = new Map(
    listPersonalTaskTargets(me.id).map((target) => [
      target.task_id,
      target.target_date,
    ]),
  );
  const tasks = listAllTasks(true).map((task) => {
    const countdown = archiveCountdownBadge(task);
    return {
      ...task,
      ...(countdown ? { badges: [countdown] } : {}),
      ...(task.assignee_id === me.id
        ? { personal_target_date: targetByTask.get(task.id) ?? null }
        : {}),
    };
  });
  const brands = listBrands();
  const people = listActivePeople();
  const unplannedGuestTasks = listUnplannedGuestTasks();
  const legacyUndatedTasks = me.is_manager === 1 ? listLegacyUndatedTasks() : [];

  const initialAssigneeId =
    sp.assignee && people.some((person) => person.id === sp.assignee) ? sp.assignee : "";
  const initialDepartment =
    sp.department && (isDepartmentId(sp.department) || sp.department === NO_DEPARTMENT)
      ? sp.department
      : "";
  const today = todayISO();
  const weekEnd = currentWeekRange().end;

  return (
    // Panom ile AYNI genişlik (layout'un max-w-7xl kabuğu). Bir dönem
    // `workspace-page-wide` (1600px) kullanıyordu; iki sayfa arasında gidip
    // gelirken pano gözle görülür şekilde sıçrıyordu.
    <div>
      <AutoRefresh />
      <PageHeader
        eyebrow="ÇALIŞMA ALANI"
        title="Görevler"
        description="Portföydeki tüm işleri ara, filtrele ve ekip ya da süreç bazında incele."
        actions={
          <>
            <Link
              href="/templates"
              className="ui-press inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-border-default bg-surface px-3 text-xs font-semibold text-secondary shadow-sm hover:bg-surface-hover hover:text-foreground"
            >
              <Icon name="templates" className="size-4 text-brand-500" />
              Şablonlar
            </Link>
            <TaskPlanningQueue guestTasks={unplannedGuestTasks} legacyTasks={legacyUndatedTasks} />
          </>
        }
      />
      <TaskExplorer
        tasks={tasks}
        brands={brands}
        people={people}
        initialAssigneeId={initialAssigneeId}
        initialDepartment={initialDepartment}
        initialFocus={parseTaskFocus(sp.focus)}
        focusToday={today}
        focusWeekEnd={weekEnd}
        initialView={initialView}
        canDeleteTasks={me.is_manager === 1}
      />
    </div>
  );
}
