import AutoRefresh from "@/components/AutoRefresh";
import { cookies } from "next/headers";
import Link from "next/link";
import TaskExplorer from "@/components/TaskExplorer";
import { listTaskPage } from "@/lib/repositories/taskListing";
import { parseTaskPage, parseTaskListSort } from "@/lib/taskPagination";
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
import { listBrandsAlphabetically } from "@/lib/repositories/brands";
import { listActivePeople } from "@/lib/repositories/people";
import { countArchivedTasks, sweepArchivablePublishedTasks } from "@/lib/repositories/tasks";
import { archiveCountdownBadge } from "@/lib/taskArchive";
import { TASKS_VIEW_PREFERENCE, parseWorkspaceView } from "@/lib/uiPreferences";

export const dynamic = "force-dynamic";

export default async function AllTasksPage({
  searchParams,
}: {
  searchParams: Promise<TaskFilterSearchParams & { page?: string; column?: string; dir?: string }>;
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
  const archivedCount = countArchivedTasks();
  const brands = listBrandsAlphabetically();
  const people = listActivePeople();

  const parsedFilters = parseTaskFilterParams(sp);
  const initialFilters = {
    ...parsedFilters,
    assignee: parsedFilters.assignee === "__unassigned__" || people.some((person) => person.id === parsedFilters.assignee)
      ? parsedFilters.assignee
      : "",
    brand: brands.some((brand) => brand.id === parsedFilters.brand) ? parsedFilters.brand : "",
  };
  const today = todayISO();
  const weekEnd = currentWeekRange().end;
  const listSort = parseTaskListSort(sp.column, sp.dir);
  const result = listTaskPage(me.id, initialFilters, { page: parseTaskPage(sp.page), sort: listSort, today, weekEnd });
  const tasks = result.tasks.map(task => {
    const countdown = archiveCountdownBadge(task);
    return { ...task, ...(countdown ? { badges: [countdown] } : {}) };
  });

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
            <Link href="/tasks/planning" className={buttonClass({ variant: "secondary" })}><Icon name="calendar" className="size-4" />Tarih bekleyenler</Link>
            {/* Toplu üretim yalnızca yöneticide: paketler yönetici önizlemesiyle açılır. */}
            {me.is_manager === 1 && (
              <Link href="/tasks/planning/aylik" className={buttonClass({ variant: "secondary" })}>
                <Icon name="board" className="size-4" />
                Aylık paket
              </Link>
            )}
          </>
        }
      />
      <TaskExplorer
        key={JSON.stringify([{ ...initialFilters, q: "" },result.page,listSort])}
        pagination={{ total: result.total, totalActive: result.totalActive, page: result.page, pages: result.pages, allDepartments: result.allDepartments, departmentCounts: result.departmentCounts }}
        listSort={listSort}
        tasks={tasks}
        brands={brands.map(({ id, name }) => ({ id, name }))}
        people={people}
        initialFilters={initialFilters}
        initialView={initialView}
        canDeleteTasks={canDeleteTasks(me)}
        archivedCount={archivedCount}
      />
    </div>
  );
}
