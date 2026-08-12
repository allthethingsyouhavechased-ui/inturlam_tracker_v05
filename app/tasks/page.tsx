import AutoRefresh from "@/components/AutoRefresh";
import { cookies } from "next/headers";
import TaskExplorer from "@/components/TaskExplorer";
import PageHeader from "@/components/ui/PageHeader";
import { isDepartmentId, NO_DEPARTMENT } from "@/lib/departments";
import { requirePageSession } from "@/lib/identity";
import { listBrands } from "@/lib/repositories/brands";
import { listPersonalTaskTargets } from "@/lib/repositories/personalTargets";
import { listActivePeople } from "@/lib/repositories/people";
import { listAllTasks, sweepArchivablePublishedTasks } from "@/lib/repositories/tasks";
import { listLegacyUndatedTasks, listUnplannedGuestTasks } from "@/lib/repositories/guestTasks";
import { archiveCountdownBadge } from "@/lib/taskArchive";
import { TASKS_VIEW_PREFERENCE, parseWorkspaceView } from "@/lib/uiPreferences";

export const dynamic = "force-dynamic";

// Filtreler istemci state'inde tutuluyor; URL yalnızca BAŞLANGIÇ değerini
// veriyor (rapor sayfasından "Görevlerini aç" / "Ekibin görevleri" linkleri).
// Kullanıcı sonrasında filtreyi değiştirdiğinde URL güncellenmiyor — bilinçli:
// her tıklamada sunucu render'ı tetiklemek listeyi yavaşlatırdı.
export default async function AllTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ assignee?: string; department?: string }>;
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
      />
      {(unplannedGuestTasks.length > 0 || legacyUndatedTasks.length > 0) && <section className="mb-5 grid gap-3 lg:grid-cols-2">{unplannedGuestTasks.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20"><h2 className="text-sm font-semibold text-foreground">Planlanacak guest görevleri · {unplannedGuestTasks.length}</h2><div className="mt-2 space-y-1">{unplannedGuestTasks.map((task) => <a key={task.id} href={`/tasks/${task.id}`} className="flex justify-between gap-3 py-1 text-xs text-secondary hover:text-brand-600"><span className="truncate">{task.brand_name} · {task.title}</span><span className="shrink-0">İstenen {task.requested_date}</span></a>)}</div></div>}{legacyUndatedTasks.length > 0 && <div className="rounded-xl border border-border-default bg-surface-subtle p-4"><h2 className="text-sm font-semibold text-foreground">Tarih bekleyen eski görevler · {legacyUndatedTasks.length}</h2><div className="mt-2 space-y-1">{legacyUndatedTasks.map((task) => <a key={task.id} href={`/tasks/${task.id}`} className="block truncate py-1 text-xs text-secondary hover:text-brand-600">{task.brand_name} · {task.title}</a>)}</div></div>}</section>}
      <TaskExplorer
        tasks={tasks}
        brands={brands}
        people={people}
        initialAssigneeId={initialAssigneeId}
        initialDepartment={initialDepartment}
        initialView={initialView}
      />
    </div>
  );
}
