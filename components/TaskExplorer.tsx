"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import SavedTaskViews from "@/components/SavedTaskViews";
import TaskBoard, { type SortKey } from "@/components/TaskBoard";
import TaskListView, {
  ALL_TASK_LIST_COLUMNS,
  DEFAULT_TASK_LIST_COLUMNS,
  TaskListColumnsControl,
} from "@/components/TaskListView";
import WorkspaceViewToggle from "@/components/WorkspaceViewToggle";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { controlClass } from "@/components/ui/Input";
import {
  TASK_PRIORITIES,
  TASK_DIFFICULTIES,
  TASK_DIFFICULTY_LABEL,
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
import type { Person, TaskDifficulty, TaskPriority, TaskStatus, TaskWithContext } from "@/lib/types";
import {
  matchesTaskMetadataFilters,
  type TaskDueFilter,
} from "@/lib/taskMetadata";
import {
  matchesTaskFocus,
  TASK_FOCUS_LABEL,
  type TaskFocus,
} from "@/lib/taskFocus";
import {
  taskFilterSearch,
  type TaskFilterState,
} from "@/lib/taskFilterParams";
import {
  TASKS_VIEW_PREFERENCE,
  rememberWorkspaceView,
  type WorkspaceView,
} from "@/lib/uiPreferences";
import { useTaskListColumns } from "@/lib/useTaskListColumns";

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
  initialFilters,
  focusToday,
  focusWeekEnd,
  initialView = "pano",
  canDeleteTasks,
  archivedCount = 0,
}: {
  tasks: TaskWithContext[];
  brands: { id: string; name: string }[];
  people: Person[];
  /** Sunucuda doğrulanmış URL filtreleri (bkz. `lib/taskFilterParams.ts`). */
  initialFilters: TaskFilterState;
  focusToday: string;
  focusWeekEnd: string;
  initialView?: WorkspaceView;
  canDeleteTasks: boolean;
  archivedCount?: number;
}) {
  const [brandId, setBrandId] = useState(initialFilters.brand);
  const [statusFilter, setStatusFilter] = useState<string>(initialFilters.status);
  const [priority, setPriority] = useState<string>(initialFilters.priority);
  const [difficulty, setDifficulty] = useState<TaskDifficulty | "" | "unset">(initialFilters.difficulty);
  const [pointsMin, setPointsMin] = useState(initialFilters.pointsMin);
  const [pointsMax, setPointsMax] = useState(initialFilters.pointsMax);
  const [due, setDue] = useState<TaskDueFilter>(initialFilters.due);
  const [dateFrom, setDateFrom] = useState(initialFilters.from);
  const [dateTo, setDateTo] = useState(initialFilters.to);
  const [department, setDepartment] = useState(initialFilters.department);
  const [assigneeId, setAssigneeId] = useState(initialFilters.assignee);
  const [focus, setFocus] = useState<TaskFocus | "">(initialFilters.focus);
  const [q, setQ] = useState(initialFilters.q);
  const [sortKey, setSortKey] = useState<SortKey>(initialFilters.sort);
  const [view, setView] = useState<WorkspaceView>(initialView);
  const [taskListColumns, setTaskListColumns, taskListLayout] = useTaskListColumns(
    "tasks",
    DEFAULT_TASK_LIST_COLUMNS,
    ALL_TASK_LIST_COLUMNS,
  );

  // Filtreler istemci state'inde kalmaya devam ediyor (her tıklamada sunucu
  // render'ı tetiklemek listeyi yavaşlatırdı) ama artık adres çubuğuna da
  // YAZILIYOR: bir filtre kombinasyonu paylaşılabiliyor ve sayfa yenilenince
  // kayboluyor değil geri geliyor.
  //
  // `router.replace` DEĞİL ham `history.replaceState`: Next router'ı sunucu
  // render'ı tetikler, bu da tam olarak kaçınmak istediğimiz şey. `pushState` de
  // değil — her tuş vuruşu geçmişe kayıt eklerdi, geri tuşu kullanılamaz olurdu.
  const currentFilters: TaskFilterState = useMemo(
    () => ({
      brand: brandId,
      status: statusFilter as TaskFilterState["status"],
      priority: priority as TaskFilterState["priority"],
      difficulty,
      pointsMin,
      pointsMax,
      due,
      from: dateFrom,
      to: dateTo,
      department,
      assignee: assigneeId,
      focus,
      q,
      sort: sortKey,
    }),
    [brandId, statusFilter, priority, difficulty, pointsMin, pointsMax, due, dateFrom, dateTo, department, assigneeId, focus, q, sortKey],
  );

  // Kayıtlı bir görünüm uygulanınca TÜM filtreler tek seferde değişir.
  function applyFilters(next: TaskFilterState) {
    setBrandId(next.brand);
    setStatusFilter(next.status);
    setPriority(next.priority);
    setDifficulty(next.difficulty);
    setPointsMin(next.pointsMin);
    setPointsMax(next.pointsMax);
    setDue(next.due);
    setDateFrom(next.from);
    setDateTo(next.to);
    setDepartment(next.department);
    setAssigneeId(next.assignee);
    setFocus(next.focus);
    setQ(next.q);
    setSortKey(next.sort);
  }

  useEffect(() => {
    const search = taskFilterSearch(currentFilters);
    const next = `${window.location.pathname}${search}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, "", next);
    }
  }, [currentFilters]);

  function changeView(next: WorkspaceView) {
    setView(next);
    rememberWorkspaceView(TASKS_VIEW_PREFERENCE, next);
  }
  const [filtersOpen, setFiltersOpen] = useState(false);
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
      if (!matchesTaskFocus(task, focus, focusToday, focusWeekEnd)) return false;
      if (brandId && task.brand_id !== brandId) return false;
      if (statusFilter && task.status !== statusFilter) return false;
      if (priority && task.priority !== priority) return false;
      if (!matchesTaskMetadataFilters(task, {
        due,
        difficulty,
        pointsMin,
        pointsMax,
        today: focusToday,
        weekEnd: focusWeekEnd,
        dateFrom,
        dateTo,
      })) return false;
      if (assigneeId === UNASSIGNED && task.assignee_id) return false;
      if (
        assigneeId &&
        assigneeId !== UNASSIGNED &&
        task.assignee_id !== assigneeId
      ) {
        return false;
      }
      if (
        needle &&
        ![task.title, task.brand_name, task.content_title, task.assignee_name ?? ""]
          .some((value) => value.toLocaleLowerCase("tr-TR").includes(needle))
      ) {
        return false;
      }
      return true;
    });
  }, [tasks, focus, focusToday, focusWeekEnd, brandId, statusFilter, priority, difficulty, pointsMin, pointsMax, due, dateFrom, dateTo, assigneeId, q]);

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
    brandId || statusFilter || priority || difficulty || pointsMin || pointsMax || due || dateFrom || dateTo || department || assigneeId || focus || q,
  );
  const filterCount = [brandId, statusFilter, priority, difficulty, pointsMin || pointsMax, due, dateFrom || dateTo, department, assigneeId].filter(Boolean).length;
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
    setDifficulty("");
    setPointsMin("");
    setPointsMax("");
    setDue("");
    setDateFrom("");
    setDateTo("");
    setDepartment("");
    setAssigneeId("");
    setFocus("");
    setQ("");
    setSortKey("varsayilan");
  }

  return (
    <div className="min-w-0 space-y-4">
      <section
        aria-label="Görev araçları"
        className="min-w-0 rounded-xl border border-border-default bg-surface p-3"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full min-w-0 basis-full sm:min-w-56 sm:basis-auto sm:flex-1">
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
          <label className="w-full min-w-0 flex-none sm:min-w-40 sm:flex-1 sm:max-w-52">
            <span className="sr-only">Departmana göre filtrele</span>
            <select
              value={department}
              onChange={(event) => changeDepartment(event.target.value)}
              className={selectClass}
              aria-label="Departmana göre filtrele"
            >
              <option value="">Tüm ekipler · {withoutDepartment.length}</option>
              {DEPARTMENTS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} · {departmentCounts.get(option.id) ?? 0}
                </option>
              ))}
              {(departmentCounts.get(NO_DEPARTMENT) ?? 0) > 0 || department === NO_DEPARTMENT ? (
                <option value={NO_DEPARTMENT}>
                  {NO_DEPARTMENT_LABEL} · {departmentCounts.get(NO_DEPARTMENT) ?? 0}
                </option>
              ) : null}
            </select>
          </label>

          <div className="flex w-full min-w-0 flex-none flex-wrap items-center gap-2 sm:flex-1 sm:flex-nowrap">
            <button
              type="button"
              onClick={() => setFiltersOpen((open) => !open)}
              aria-expanded={filtersOpen}
              className={`ui-press inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border px-2 text-[13px] font-semibold sm:flex-none sm:px-3 md:min-h-10 ${
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

            {/* Arşiv artık ayrı, salt-okunur odaklı bir sayfa. Pano sütunları
                arşiv kayıtları için anlamsız olduğu için aktif görevlerle karışmaz. */}
            {archivedCount > 0 && (
              <Link
                href="/tasks/archive"
                className="ui-press inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md border border-border-default bg-surface px-2 text-[13px] font-semibold text-muted hover:bg-surface-hover sm:flex-none sm:px-3 md:min-h-10"
              >
                <Icon name="archive" className="size-4" />
                Arşiv
                <span className="tabular-nums text-muted">{archivedCount}</span>
              </Link>
            )}

            <p className="ml-auto whitespace-nowrap text-xs text-muted">
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                {filtered.length}
              </span>{" "}
              / {tasks.length} görev
              {view === "pano" && sortKey !== "varsayilan" && (
                <span> · {SORT_LABEL[sortKey]} sıralaması</span>
              )}
            </p>

            <div className="flex items-center gap-3 sm:border-l sm:border-border-subtle sm:pl-3">
              {view === "liste" && (
                <span className="hidden md:block">
                  <TaskListColumnsControl
                    visibleColumns={taskListColumns}
                    onChange={setTaskListColumns}
                    onResetLayout={taskListLayout.resetLayout}
                  />
                </span>
              )}
              <WorkspaceViewToggle view={view} onChange={changeView} />
            </div>
          </div>
        </div>

        {(filtersOpen || hasFilter) && (
        <div className="mt-3 space-y-3 border-t border-border-subtle pt-3">
          {filtersOpen && (
          <div className="ui-enter grid gap-2 md:grid-cols-2 xl:grid-cols-4">
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
              Zorluk
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as TaskDifficulty | "" | "unset")} className={selectClass}>
                <option value="">Tüm zorluklar</option>
                {TASK_DIFFICULTIES.map((value) => <option key={value} value={value}>{TASK_DIFFICULTY_LABEL[value]}</option>)}
                <option value="unset">Belirlenmemiş</option>
              </select>
            </label>
            {/* Puan zorluktan AYRI bir filtre: zorluk üç kaba kategori, puan
                1-100 arası serbest sayı — "5 puandan ağır işler" sorusunun
                zorlukla karşılığı yok. */}
            <div className="grid min-w-0 gap-1 text-xs font-medium text-muted">
              <span>Puan aralığı</span>
              <div className="flex min-w-0 items-center gap-2">
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  value={pointsMin}
                  onChange={(event) => setPointsMin(event.target.value)}
                  placeholder="En az"
                  aria-label="En az puan"
                  className={`${selectClass} min-w-0 flex-1`}
                />
                <span aria-hidden="true" className="text-faint">–</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={100}
                  value={pointsMax}
                  onChange={(event) => setPointsMax(event.target.value)}
                  placeholder="En çok"
                  aria-label="En çok puan"
                  className={`${selectClass} min-w-0 flex-1`}
                />
              </div>
            </div>
            <label className="grid min-w-0 gap-1 text-xs font-medium text-muted">
              Teslim zamanı
              <select value={due} onChange={(event) => setDue(event.target.value as TaskDueFilter)} className={selectClass}>
                <option value="">Tüm tarihler</option>
                <option value="overdue">Gecikmiş</option>
                <option value="today">Bugün</option>
                <option value="week">Bu hafta</option>
                <option value="undated">Tarih bekleyen</option>
              </select>
            </label>
            <label className="grid min-w-0 gap-1 text-xs font-medium text-muted">
              Tarih aralığı · başlangıç
              <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} className={selectClass} />
            </label>
            <label className="grid min-w-0 gap-1 text-xs font-medium text-muted">
              Tarih aralığı · bitiş
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} className={selectClass} />
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
          <div className="flex flex-wrap items-center gap-2">
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
            {difficulty && <FilterChip label={difficulty === "unset" ? "Zorluk: Belirlenmemiş" : `Zorluk: ${TASK_DIFFICULTY_LABEL[difficulty]}`} onRemove={() => setDifficulty("")} />}
            {(pointsMin || pointsMax) && (
              <FilterChip
                label={`Puan: ${pointsMin || "…"} – ${pointsMax || "…"}`}
                onRemove={() => { setPointsMin(""); setPointsMax(""); }}
              />
            )}
            {due && <FilterChip label={{ overdue: "Gecikmiş", today: "Bugün", week: "Bu hafta", undated: "Tarih bekleyen" }[due]} onRemove={() => setDue("")} />}
            {(dateFrom || dateTo) && <FilterChip label={`Teslim: ${dateFrom || "…"} – ${dateTo || "…"}`} onRemove={() => { setDateFrom(""); setDateTo(""); }} />}
            {focus && (
              <FilterChip
                label={TASK_FOCUS_LABEL[focus]}
                onRemove={() => setFocus("")}
              />
            )}
            {q && <FilterChip label={`Arama: ${q}`} onRemove={() => setQ("")} />}
            <button
              type="button"
              onClick={clearFilters}
              className="ui-press ml-auto min-h-8 rounded-lg px-2.5 text-xs font-semibold text-danger hover:bg-rose-50 dark:hover:bg-rose-500/10"
            >
              Tümünü temizle
            </button>
          </div>
          )}

          {filtersOpen && (
            <SavedTaskViews current={currentFilters} onApply={applyFilters} />
          )}
        </div>
        )}
      </section>

      {filtered.length === 0 ? (
        <EmptyState
          title={
            hasFilter
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
        <TaskBoard
          tasks={filtered}
          people={people}
          canDeleteTasks={canDeleteTasks}
          sortKey={sortKey}
          boardId="gorevler"
        />
      ) : (
        <TaskListView
          tasks={filtered}
          people={people}
          canDeleteTasks={canDeleteTasks}
          visibleColumns={taskListColumns}
          onVisibleColumnsChange={setTaskListColumns}
          layout={taskListLayout}
          showColumnsControl={false}
        />
      )}
    </div>
  );
}
