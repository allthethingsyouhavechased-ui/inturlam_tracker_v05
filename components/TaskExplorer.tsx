"use client";

import { useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import TaskBoard, { type SortKey } from "@/components/TaskBoard";
import TaskListView from "@/components/TaskListView";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_BORDER,
  TASK_PRIORITY_ICON,
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

const UNASSIGNED = "__unassigned__";

const SORT_LABEL: Record<SortKey, string> = {
  varsayilan: "Varsayılan",
  marka: "Marka",
  durum: "Durum",
  oncelik: "Öncelik",
  atanan: "Atanan",
};

const selectClass =
  "min-h-11 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm shadow-sm outline-none transition-[border-color,box-shadow] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 dark:border-white/15 dark:bg-zinc-950";

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
}: {
  tasks: TaskWithContext[];
  brands: { id: string; name: string }[];
  people: Person[];
  initialAssigneeId?: string;
  initialDepartment?: string;
}) {
  const [brandId, setBrandId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priority, setPriority] = useState("");
  const [department, setDepartment] = useState(initialDepartment);
  const [assigneeId, setAssigneeId] = useState(initialAssigneeId);
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("varsayilan");
  const [view, setView] = useState<"pano" | "liste">("pano");
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
    <div className="space-y-4">
      <section
        aria-label="Görev araçları"
        className="rounded-2xl border border-black/10 bg-zinc-50/80 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.025]"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-64 flex-1">
            <svg
              viewBox="0 0 20 20"
              fill="currentColor"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z"
                clipRule="evenodd"
              />
            </svg>
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
                className="ui-press absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-lg text-zinc-400 hover:bg-black/5 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-zinc-200"
              >
                ×
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            className={`ui-press inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium ${
              filtersOpen || filterCount > 0
                ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-950/40 dark:text-brand-300"
                : "border-black/10 bg-white text-zinc-600 hover:bg-black/5 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10"
            }`}
          >
            <svg viewBox="0 0 20 20" fill="none" className="size-4" stroke="currentColor">
              <path d="M3 5h14M6 10h8M8.5 15h3" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
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
                  : "border-black/10 bg-white text-zinc-600 hover:bg-black/5 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10"
              }`}
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="size-4" aria-hidden="true">
                <path d="M2 4.25A1.25 1.25 0 0 1 3.25 3h13.5A1.25 1.25 0 0 1 18 4.25v1.5A1.25 1.25 0 0 1 16.75 7H3.25A1.25 1.25 0 0 1 2 5.75v-1.5Z" />
                <path
                  fillRule="evenodd"
                  d="M3 8.5h14v6.25A2.25 2.25 0 0 1 14.75 17h-9.5A2.25 2.25 0 0 1 3 14.75V8.5Zm4.25 2a.75.75 0 0 0 0 1.5h5.5a.75.75 0 0 0 0-1.5h-5.5Z"
                  clipRule="evenodd"
                />
              </svg>
              {archiveOnly ? "Arşivden çık" : "Arşiv"}
              <span
                className={`tabular-nums ${
                  archiveOnly ? "text-white/75" : "text-zinc-500 dark:text-zinc-400"
                }`}
              >
                {archivedCount}
              </span>
            </button>
          )}

          <div className="inline-flex overflow-hidden rounded-xl border border-black/10 bg-white p-0.5 text-xs shadow-sm dark:border-white/15 dark:bg-zinc-950">
            {(["pano", "liste"] as const).map((nextView) => (
              <button
                key={nextView}
                type="button"
                onClick={() => setView(nextView)}
                aria-pressed={view === nextView}
                className={`ui-press min-h-10 rounded-lg px-3 font-medium ${
                  view === nextView
                    ? "bg-brand-600 text-white"
                    : "text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
                }`}
              >
                {nextView === "pano" ? "Pano" : "Liste"}
              </button>
            ))}
          </div>
        </div>

        <div
          className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-black/[0.07] pt-3 dark:border-white/10"
          role="group"
          aria-label="Departmana göre filtrele"
        >
          <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
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
                    : "border-black/10 bg-white text-zinc-600 hover:bg-black/5 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10"
                }`}
              >
                {option.label}
                <span
                  className={`tabular-nums ${
                    department === option.id
                      ? "text-white/75"
                      : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {option.count}
                </span>
              </button>
            ))}
        </div>

        {filtersOpen && (
          <div className="ui-enter mt-3 grid gap-2 border-t border-black/[0.07] pt-3 md:grid-cols-2 xl:grid-cols-4 dark:border-white/10">
            <label className="grid min-w-0 gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
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
            <label className="grid min-w-0 gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
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
            <label className="grid min-w-0 gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
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
            <label className="grid min-w-0 gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
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
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/[0.07] pt-3 dark:border-white/10">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
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
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
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
          className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400"
          aria-label="Kart çerçevesi öncelik renkleri"
        >
          <span className="font-medium">Kart çerçevesi = öncelik:</span>
          {TASK_PRIORITIES.map((taskPriority) => (
            <span key={taskPriority} className="inline-flex items-center gap-1">
              <span
                className={`size-3 rounded border-2 bg-white dark:bg-zinc-900 ${TASK_PRIORITY_BORDER[taskPriority]}`}
                aria-hidden="true"
              />
              <span aria-hidden="true">{TASK_PRIORITY_ICON[taskPriority]}</span>
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
              <button
                type="button"
                onClick={clearFilters}
                className="ui-press min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-500"
              >
                Filtreleri temizle
              </button>
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
