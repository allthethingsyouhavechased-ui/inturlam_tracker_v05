import AutoRefresh from "@/components/AutoRefresh";
import { cookies } from "next/headers";
import Link from "next/link";
import TaskExplorer from "@/components/TaskExplorer";
import TaskPlanningQueue from "@/components/TaskPlanningQueue";
import { buttonClass } from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import Icon from "@/components/ui/Icon";
import { currentWeekRange, todayISO } from "@/lib/date";
import {
  parseTaskFilterParams,
  type TaskFilterSearchParams,
} from "@/lib/taskFilterParams";
import { canDeleteTasks } from "@/lib/auth/authorization";
import { requirePageSession } from "@/lib/identity";
import { listBrands } from "@/lib/repositories/brands";
import { listPersonalTaskTargets } from "@/lib/repositories/personalTargets";
import { listActivePeople } from "@/lib/repositories/people";
import { countArchivedTasks, listAllTasks, sweepArchivablePublishedTasks } from "@/lib/repositories/tasks";
import { listLegacyUndatedTasks, listUnplannedGuestTasks } from "@/lib/repositories/guestTasks";
import { archiveCountdownBadge } from "@/lib/taskArchive";
import { TASKS_VIEW_PREFERENCE, parseWorkspaceView } from "@/lib/uiPreferences";

export const dynamic = "force-dynamic";

// Filtreler istemci state'inde tutuluyor — her tıklamada sunucu render'ı
// tetiklemek listeyi yavaşlatırdı. URL bu yüzden yalnızca BAŞLANGIÇ değerini
// veriyor; istemci sonrasında `history.replaceState` ile adres çubuğunu
// güncelliyor (bkz. `components/TaskExplorer.tsx`), yani sunucuya dönmeden
// bağlantı paylaşılabilir ve yenilemede filtre korunur kalıyor.
// Değer doğrulaması `lib/taskFilterParams.ts`'te tek yerde; marka ve kişi
// id'leri veritabanı bilgisi gerektirdiği için burada ayrıca süzülüyor.
export default async function AllTasksPage({
  searchParams,
}: {
  searchParams: Promise<TaskFilterSearchParams>;
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
  // Arşiv ayrı sayfada okunur; aktif görev ekranı yüzlerce eski kaydı istemciye
  // taşımaz ve pano görünümünün tek "Yayınlandı" sütununa yığmaz.
  // Geri sayım rozeti SUNUCUDA iliştiriliyor (bkz. `archiveCountdownBadge`):
  // kart bileşeni istemci tarafında, orada `new Date()` çağırmak gün sınırında
  // hydration uyuşmazlığı üretebilirdi.
  const targetByTask = new Map(
    listPersonalTaskTargets(me.id).map((target) => [
      target.task_id,
      target.target_date,
    ]),
  );
  const tasks = listAllTasks().map((task) => {
    const countdown = archiveCountdownBadge(task);
    return {
      ...task,
      ...(countdown ? { badges: [countdown] } : {}),
      ...(task.assignee_id === me.id
        ? { personal_target_date: targetByTask.get(task.id) ?? null }
        : {}),
    };
  });
  const archivedCount = countArchivedTasks();
  const brands = listBrands();
  const people = listActivePeople();
  const unplannedGuestTasks = listUnplannedGuestTasks();
  const legacyUndatedTasks = me.is_manager === 1 ? listLegacyUndatedTasks() : [];

  const parsedFilters = parseTaskFilterParams(sp);
  const initialFilters = {
    ...parsedFilters,
    assignee: people.some((person) => person.id === parsedFilters.assignee)
      ? parsedFilters.assignee
      : "",
    brand: brands.some((brand) => brand.id === parsedFilters.brand) ? parsedFilters.brand : "",
  };
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
              className={buttonClass({ variant: "secondary" })}
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
        initialFilters={initialFilters}
        focusToday={today}
        focusWeekEnd={weekEnd}
        initialView={initialView}
        canDeleteTasks={canDeleteTasks(me)}
        archivedCount={archivedCount}
      />
    </div>
  );
}
