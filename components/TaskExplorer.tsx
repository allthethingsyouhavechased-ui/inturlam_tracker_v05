"use client";

import { useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import TaskBoard, { type SortKey } from "@/components/TaskBoard";
import TaskListView from "@/components/TaskListView";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { controlClass } from "@/components/ui/Input";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_DOT,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUSES,
} from "@/lib/constants";
import {
  DEPARTMENTS,
  NO_DEPARTMENT,
  NO_DEPARTMENT_LABEL,
  departmentKey,
  departmentLabel,
} from "@/lib/departments";
import type { Person, TaskPriority, TaskStatus, TaskWithContext } from "@/lib/types";
import {
  TASKS_VIEW_PREFERENCE,
  rememberWorkspaceView,
  type WorkspaceView,
} from "@/lib/uiPreferences";

const UNASSIGNED = "__unassigned__";

const SORT_LABEL: Record<SortKey, string> = {
  varsayilan: "Varsayılan",
  marka: "Marka",
  durum: "Durum",
  oncelik: "Öncelik",
  atanan: "Atanan",
};

const selectClass = controlClass("focus:ring-2 focus:ring-brand-500/15");

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={`${label} filtresini kaldır`}
      className="ui-press inline-flex min-h-8 items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-2.5 text-xs font-medium text-brand-700 hover:border-brand-300 dark:border-brand-800 dark:bg-brand-950/40 dark:text-brand-300"
    >
      {label}
      <span className="text-base leading-none" aria-hidden="true">
        ×
      </span>
    </button>
  );
}

export default function TaskExplorer({
  tasks,
  brands,
  people,
  initialAssigneeId = "",
  initialDepartment = "",
  initialView = "pano",
}: {
  tasks: TaskWithContext[];
  brands: { id: string; name: string }[];
  people: Person[];
  initialAssigneeId?: string;
  initialDepartment?: string;
  initialView?: WorkspaceView;
}) {
  const [brandId, setBrandId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priority, setPriority] = useState("");
  const [department, setDepartment] = useState(initialDepartment);
  const [assigneeId, setAssigneeId] = useState(initialAssigneeId);
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("varsayilan");
  const [view, setView] = useState<WorkspaceView>(initialView);

  function changeView(next: WorkspaceView) {
    setView(next);
    rememberWorkspaceView(TASKS_VIEW_PREFERENCE, next);
  }
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Arşiv bir "ekle/çıkar" anahtarı DEĞİL, ayrı bir görünüm: kapalıyken arşiv
  // tamamen gizli, açıkken SADECE arşiv listelenir. Karışık liste denenmişti —
  // yüzlerce görevin arasına birkaç arşiv kaydı serpiştirmek onları bulunmaz
  // yapıyordu, düğme de bir işe yaramıyordu.
  const [archiveOnly, setArchiveOnly] = useState(false);

  const archivedCount = useMemo(
    () => tasks.filter((task) => task.archived_at !== null).length,
    [tasks],
  );

  // Departman görevin değil, görevi üstlenen kişinin özelliği: filtre
  // atanan üzerinden dolaylı çalışıyor. Bu yüzden atanmamış görevler bir
  // departman seçiliyken listeden düşer — hangi ekibe ait oldukları bilinmiyor.
  const departmentByPerson = useMemo(
    () => new Map(people.map((person) => [person.id, departmentKey(person.department)])),
    [people],
  );
  const departmentPeople = useMemo(
    () =>
      department
        ? people.filter((person) => departmentKey(person.department) === department)
        : [],
    [people, department],
  );

  // Departman DIŞINDAKİ tüm filtreleri geçen görevler. Departman sekmelerindeki
  // sayılar buradan geliyor: seçili sekme sayıyı kendi üzerine kilitlemesin,
  // "diğer ekipte kaç iş var" bilgisi seçim yapınca kaybolmasın.
  const withoutDepartment = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("tr-TR");
    return tasks.filter((task) => {
      // Tek satırda iki mod: arşiv görünümünde yalnızca arşivlenenler,
      // normal görünümde yalnızca arşivlenmemişler kalır.
      if (archiveOnly !== (task.archived_at !== null)) return false;
      if (brandId && task.brand_id !== brandId) return false;
      if (statusFilter && task.status !== statusFilter) return false;
      if (priority && task.priority !== priority) return false;
      if (assigneeId === UNASSIGNED && task.assignee_id) return false;
      if (
        assigneeId &&
        assigneeId !== UNASSIGNED &&
        task.assignee_id !== assigneeId
      ) {
        return false;
      }
      if (needle && !task.title.toLocaleLowerCase("tr-TR").includes(needle)) {
        return false;
      }
      return true;
    });
  }, [tasks, archiveOnly, brandId, statusFilter, priority, assigneeId, q]);

  const departmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of withoutDepartment) {
      if (!task.assignee_id) continue;
      const key = departmentByPerson.get(task.assignee_id);
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [withoutDepartment, departmentByPerson]);

  const filtered = useMemo(() => {
    if (!department) return withoutDepartment;
    return withoutDepartment.filter(
      (task) =>
        task.assignee_id != null &&
        departmentByPerson.get(task.assignee_id) === department,
    );
  }, [withoutDepartment, department, departmentByPerson]);

  const hasFilter = Boolean(
    brandId || statusFilter || priority || department || assigneeId || q,
  );
  // Rozet, "Filtreler" panelinin içindekileri sayar; departman panelde değil,
  // her zaman görünen sekme satırında seçiliyor.
  const filterCount = [brandId, statusFilter, priority, assigneeId].filter(Boolean).length;
  const selectedBrand = brands.find((brand) => brand.id === brandId);
  const selectedPerson = people.find((person) => person.id === assigneeId);

  // Departman seçiliyken "Atanan" listesi o ekibe daralır; başka bir departmanın
  // kişisi seçili kalırsa sonuç hep boş olurdu, o yüzden seçim sıfırlanır.
  function changeDepartment(nextDepartment: string) {
    setDepartment(nextDepartment);
    if (nextDepartment) setSortKey("atanan");
    if (
      nextDepartment &&
      assigneeId &&
      (assigneeId === UNASSIGNED ||
        departmentByPerson.get(assigneeId) !== nextDepartment)
    ) {
      setAssigneeId("");
    }
  }

  function clearFilters() {
    setBrandId("");
    setStatusFilter("");
    setPriority("");
    setDepartment("");
    setAssigneeId("");
    setQ("");
    setSortKey("varsayilan");
  }

  return (
    <div className="min-w-0 space-y-4">
      <section
        aria-label="Görev araçları"
        className="min-w-0 overflow-hidden rounded-xl border border-border-default bg-surface p-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full min-w-0 basis-full sm:min-w-64 sm:basis-auto sm:flex-1">
            <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              aria-label="Görev ara"
              placeholder="Görev başlığında ara…"
              className={`${selectClass} w-full pl-10 ${q ? "pr-10" : ""}`}
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                aria-label="Aramayı temizle"
                className="ui-press absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-faint hover:bg-surface-hover hover:text-secondary"
              >
                <Icon name="close" className="size-3.5" />
              </button>
            )}
          </div>

        </div>

        <div
          className="mt-3 flex flex-col gap-3 border-t border-border-subtle pt-3 lg:flex-row lg:items-center lg:justify-between"
        >
          <div
            className="flex min-w-0 flex-wrap items-center gap-1.5"
            role="group"
            aria-label="Departmana göre filtrele"
          >
            <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted">
              Ekip
            </span>
            {[
            { id: "", label: "Tümü", count: withoutDepartment.length },
            ...DEPARTMENTS.map((option) => ({
              id: option.id as string,
              label: option.label,
              count: departmentCounts.get(option.id) ?? 0,
            })),
            {
              id: NO_DEPARTMENT,
              label: NO_DEPARTMENT_LABEL,
              count: departmentCounts.get(NO_DEPARTMENT) ?? 0,
            },
          ]
            // Sabit dört departman (Video/Tasarım/Sosyal Medya/Yönetim) HER ZAMAN
            // görünür — o an açık görevi olmayan bir ekip "filtrede hiç yok" gibi
            // görünmesin diye (ekibin sıfır açık işi olduğunu görmek de bir
            // bilgi). Yalnızca "Diğer" kovası (departmanı olmayan biri) gerçek
            // bir ekip değil; ancak dolu olduğunda ya da seçiliyken gösterilir.
            .filter(
              (option) =>
                option.id !== NO_DEPARTMENT || option.count > 0 || option.id === department,
            )
            .map((option) => (
              <button
                key={option.id || "all"}
                type="button"
                onClick={() => changeDepartment(option.id)}
                aria-pressed={department === option.id}
                className={`ui-press inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${
                  department === option.id
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-border-default bg-surface text-muted hover:bg-surface-hover"
                }`}
              >
                {option.label}
                <span
                  className={`tabular-nums ${
                    department === option.id
                      ? "text-white/75"
                      : "text-muted"
                  }`}
                >
                  {option.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              className={`ui-press inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium ${
                filtersOpen || filterCount > 0
                  ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                  : "border-border-default bg-surface text-muted hover:bg-surface-hover"
              }`}
            >
              <Icon name="filter" className="size-4" />
              Filtreler
              {filterCount > 0 && (
                <span className="grid size-5 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">
                  {filterCount}
                </span>
              )}
            </button>

            {/* Yayınlanan görevler panoda kalır, ARCHIVE_AFTER_DAYS gün sonra
                arşive düşer. Düğme ayrı bir GÖRÜNÜM açar (bkz. `archiveOnly`) —
                hiç arşivlenmiş iş yoksa görünmez. */}
            {archivedCount > 0 && (
              <button
                type="button"
                onClick={() => setArchiveOnly((only) => !only)}
                aria-pressed={archiveOnly}
                className={`ui-press inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium ${
                  archiveOnly
                    ? "border-brand-600 bg-brand-600 text-white"
                    : "border-border-default bg-surface text-muted hover:bg-surface-hover"
                }`}
              >
                <Icon name="archive" className="size-4" />
                {archiveOnly ? "Arşivden çık" : "Arşiv"}
                <span className={`tabular-nums ${archiveOnly ? "text-white/75" : "text-muted"}`}>
                  {archivedCount}
                </span>
              </button>
            )}

            <div className="inline-flex overflow-hidden rounded-[10px] border border-border-default bg-surface-subtle p-0.5 text-xs">
              {(["pano", "liste"] as const).map((nextView) => (
                <button
                  key={nextView}
                  type="button"
                  onClick={() => changeView(nextView)}
                  aria-pressed={view === nextView}
                  className={`ui-press min-h-10 rounded-lg px-3 font-medium ${
                    view === nextView
                      ? "bg-surface text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)]"
                      : "text-muted hover:bg-surface-hover hover:text-secondary"
                  }`}
                >
                  {nextView === "pano" ? "Pano" : "Liste"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtersOpen && (
          <div className="ui-enter mt-3 grid gap-2 border-t border-border-subtle pt-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="grid min-w-0 gap-1 text-xs font-medium text-muted">
              Marka
              <select
                value={brandId}
                onChange={(event) => {
                  setBrandId(event.target.value);
                  setSortKey("marka");
                }}
                className={selectClass}
              >
                <option value="">Tüm markalar</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1 text-xs font-medium text-muted">
              Durum
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setSortKey("durum");
                }}
                className={selectClass}
              >
                <option value="">Tüm durumlar</option>
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {TASK_STATUS_LABEL[status]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1 text-xs font-medium text-muted">
              Öncelik
              <select
                value={priority}
                onChange={(event) => {
                  setPriority(event.target.value);
                  setSortKey("oncelik");
                }}
                className={selectClass}
              >
                <option value="">Tüm öncelikler</option>
                {TASK_PRIORITIES.map((taskPriority) => (
                  <option key={taskPriority} value={taskPriority}>
                    {TASK_PRIORITY_LABEL[taskPriority]}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid min-w-0 gap-1 text-xs font-medium text-muted">
              Atanan
              <select
                value={assigneeId}
                onChange={(event) => {
                  setAssigneeId(event.target.value);
                  setSortKey("atanan");
                }}
                className={selectClass}
              >
                <option value="">{department ? "Departmandaki herkes" : "Herkes"}</option>
                {!department && <option value={UNASSIGNED}>Atanmamış</option>}
                {(department ? departmentPeople : people).map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        {hasFilter && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-3">
            <span className="text-xs font-medium text-muted">
              Aktif:
            </span>
            {selectedBrand && (
              <FilterChip label={selectedBrand.name} onRemove={() => setBrandId("")} />
            )}
            {statusFilter && (
              <FilterChip
                label={TASK_STATUS_LABEL[statusFilter as TaskStatus]}
                onRemove={() => setStatusFilter("")}
              />
            )}
            {priority && (
              <FilterChip
                label={TASK_PRIORITY_LABEL[priority as TaskPriority]}
                onRemove={() => setPriority("")}
              />
            )}
            {department && (
              <FilterChip
                label={
                  department === NO_DEPARTMENT
                    ? NO_DEPARTMENT_LABEL
                    : `${departmentLabel(department)} ekibi`
                }
                onRemove={() => setDepartment("")}
              />
            )}
            {assigneeId && (
              <FilterChip
                label={
                  assigneeId === UNASSIGNED
                    ? "Atanmamış"
                    : (selectedPerson?.name ?? "Kişi")
                }
                onRemove={() => setAssigneeId("")}
              />
            )}
            {q && <FilterChip label={`Arama: ${q}`} onRemove={() => setQ("")} />}
            <button
              type="button"
              onClick={clearFilters}
              className="ui-press ml-auto min-h-8 rounded-lg px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
            >
              Tümünü temizle
            </button>
          </div>
        )}
      </section>

      {/* Arşiv görünümünde neye baktığın ve nasıl geri alacağın açıkça yazsın —
          bu liste "kayıp görevler" değil, kasıtlı olarak kenara çekilmiş işler. */}
      {archiveOnly && (
        <div className="ui-enter flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/70 px-4 py-3 text-sm dark:border-brand-900 dark:bg-brand-950/25">
          <p className="text-zinc-700 dark:text-zinc-200">
            <strong className="font-semibold">Arşiv görünümü.</strong> Yayınlandıktan
            sonra panodan çekilen görevler — silinmediler. Geri almak için kartı
            başka bir duruma sürükle ya da görevi açıp{" "}
            <strong className="font-semibold">“Arşivden çıkar”</strong> de.
          </p>
          <button
            type="button"
            onClick={() => setArchiveOnly(false)}
            className="ui-press min-h-9 shrink-0 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-500"
          >
            Aktif görevlere dön
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          <span className="font-semibold text-zinc-700 dark:text-zinc-200">
            {filtered.length}
          </span>{" "}
          / {archiveOnly ? archivedCount : tasks.length - archivedCount}{" "}
          {archiveOnly ? "arşivlenmiş görev" : "görev"}
          {view === "pano" && sortKey !== "varsayilan" && (
            <span> · {SORT_LABEL[sortKey]} sıralaması</span>
          )}
          {view === "liste" && <span> · sütun başlıklarından sıralanabilir</span>}
        </p>

        <div
            className="hidden flex-wrap items-center gap-2 text-[11px] text-muted sm:flex"
          aria-label="Kart öncelik göstergeleri"
        >
          <span className="font-medium">Sol çizgi = öncelik:</span>
          {TASK_PRIORITIES.map((taskPriority) => (
            <span key={taskPriority} className="inline-flex items-center gap-1">
              <span
                className={`h-3 w-0.5 rounded-full ${TASK_PRIORITY_DOT[taskPriority]}`}
                aria-hidden="true"
              />
              {TASK_PRIORITY_LABEL[taskPriority]}
            </span>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            archiveOnly
              ? "Bu filtrelerle eşleşen arşiv kaydı yok"
              : hasFilter
                ? "Bu filtrelerle eşleşen görev yok"
                : "Henüz görev yok"
          }
          description={
            hasFilter
              ? "Filtrelerden birini kaldırabilir veya arama metnini değiştirebilirsin."
              : "Yeni bir görev oluşturulduğunda pano burada dolmaya başlayacak."
          }
          action={
            hasFilter ? (
              <Button onClick={clearFilters}>Filtreleri temizle</Button>
            ) : undefined
          }
        />
      ) : view === "pano" ? (
        <TaskBoard tasks={filtered} sortKey={sortKey} boardId="gorevler" />
      ) : (
        <TaskListView tasks={filtered} people={people} />
      )}
    </div>
  );
}
