"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import TaskBoard, { type SortKey } from "@/components/TaskBoard";
import TaskListView from "@/components/TaskListView";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { controlClass } from "@/components/ui/Input";
import {
  TASK_PRIORITIES,
  TASK_DIFFICULTIES,
  TASK_DIFFICULTY_LABEL,
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
import type { Person, TaskDifficulty, TaskPriority, TaskStatus, TaskWithContext } from "@/lib/types";
import {
  matchesTaskMetadataFilters,
  type TaskDueFilter,
  type TaskRevisionFilter,
} from "@/lib/taskMetadata";
import {
  matchesTaskFocus,
  TASK_FOCUS_LABEL,
  type TaskFocus,
} from "@/lib/taskFocus";
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
  initialFocus = "",
  focusToday,
  focusWeekEnd,
  initialView = "pano",
  canDeleteTasks,
  archivedCount = 0,
}: {
  tasks: TaskWithContext[];
  brands: { id: string; name: string }[];
  people: Person[];
  initialAssigneeId?: string;
  initialDepartment?: string;
  initialFocus?: TaskFocus | "";
  focusToday: string;
  focusWeekEnd: string;
  initialView?: WorkspaceView;
  canDeleteTasks: boolean;
  archivedCount?: number;
}) {
  const [brandId, setBrandId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priority, setPriority] = useState("");
  const [difficulty, setDifficulty] = useState<TaskDifficulty | "" | "unset">("");
  const [due, setDue] = useState<TaskDueFilter>("");
  const [revision, setRevision] = useState<TaskRevisionFilter>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [department, setDepartment] = useState(initialDepartment);
  const [assigneeId, setAssigneeId] = useState(initialAssigneeId);
  const [focus, setFocus] = useState<TaskFocus | "">(initialFocus);
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("varsayilan");
  const [view, setView] = useState<WorkspaceView>(initialView);

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
        revision,
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
  }, [tasks, focus, focusToday, focusWeekEnd, brandId, statusFilter, priority, difficulty, due, revision, dateFrom, dateTo, assigneeId, q]);

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
    brandId || statusFilter || priority || difficulty || due || revision || dateFrom || dateTo || department || assigneeId || focus || q,
  );
  // Rozet, "Filtreler" panelinin içindekileri sayar; departman panelde değil,
  // her zaman görünen sekme satırında seçiliyor.
  const filterCount = [brandId, statusFilter, priority, difficulty, due, revision, dateFrom || dateTo, assigneeId].filter(Boolean).length;
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
    setDue("");
    setRevision("");
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

            {/* Arşiv artık ayrı, salt-okunur odaklı bir sayfa. Pano sütunları
                arşiv kayıtları için anlamsız olduğu için aktif görevlerle karışmaz. */}
            {archivedCount > 0 && (
              <Link
                href="/tasks/archive"
                className="ui-press inline-flex min-h-11 items-center gap-2 rounded-xl border border-border-default bg-surface px-3 text-sm font-medium text-muted hover:bg-surface-hover"
              >
                <Icon name="archive" className="size-4" />
                Arşiv
                <span className="tabular-nums text-muted">{archivedCount}</span>
              </Link>
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
              Zorluk
              <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as TaskDifficulty | "" | "unset")} className={selectClass}>
                <option value="">Tüm zorluklar</option>
                {TASK_DIFFICULTIES.map((value) => <option key={value} value={value}>{TASK_DIFFICULTY_LABEL[value]}</option>)}
                <option value="unset">Belirlenmemiş</option>
              </select>
            </label>
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
              Revize
              <select value={revision} onChange={(event) => setRevision(event.target.value as TaskRevisionFilter)} className={selectClass}>
                <option value="">Tüm revizeler</option>
                <option value="none">Revizesiz</option>
                <option value="active">Aktif revizede</option>
                <option value="completed">Revizesi tamamlanmış</option>
                <option value="overdue">Hedef süreyi aşmış</option>
                <option value="three-plus">3+ tur</option>
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
            {difficulty && <FilterChip label={difficulty === "unset" ? "Zorluk: Belirlenmemiş" : `Zorluk: ${TASK_DIFFICULTY_LABEL[difficulty]}`} onRemove={() => setDifficulty("")} />}
            {due && <FilterChip label={{ overdue: "Gecikmiş", today: "Bugün", week: "Bu hafta", undated: "Tarih bekleyen" }[due]} onRemove={() => setDue("")} />}
            {revision && <FilterChip label={{ none: "Revizesiz", active: "Aktif revize", completed: "Tamamlanmış revize", overdue: "Revize süresi aşılmış", "three-plus": "3+ revize" }[revision]} onRemove={() => setRevision("")} />}
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
              className="ui-press ml-auto min-h-8 rounded-lg px-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
            >
              Tümünü temizle
            </button>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">
          <span className="font-semibold text-zinc-700 dark:text-zinc-200">
            {filtered.length}
          </span>{" "}
          / {tasks.length} görev
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
        <TaskBoard tasks={filtered} sortKey={sortKey} boardId="gorevler" />
      ) : (
        <TaskListView tasks={filtered} people={people} canDeleteTasks={canDeleteTasks} />
      )}
    </div>
  );
}
