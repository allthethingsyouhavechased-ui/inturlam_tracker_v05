"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import AssigneeSelect from "@/components/AssigneeSelect";
import CommentIcon from "@/components/CommentIcon";
import PersonAvatar from "@/components/PersonAvatar";
import TaskCommentsPanel from "@/components/TaskCommentsPanel";
import TaskContextMenu, { useTaskContextMenu } from "@/components/TaskContextMenu";
import TaskDueDateEdit from "@/components/TaskDueDateEdit";
import TaskDifficultySelect from "@/components/TaskDifficultySelect";
import TaskPrioritySelect from "@/components/TaskPrioritySelect";
import TaskQuickRevisionDialog from "@/components/TaskQuickRevisionDialog";
import TaskStatusSelect from "@/components/TaskStatusSelect";
import TaskTargetDateEdit from "@/components/TaskTargetDateEdit";
import Icon from "@/components/ui/Icon";
import { brandAccentStyle } from "@/lib/brandAccent";
import { formatDateShort } from "@/lib/date";
import { formatRevisionDuration, isRevisionOverTarget } from "@/lib/taskMetadata";
import { runUndoable } from "@/lib/undoQueue";
import {
  bulkDeleteTasksAction,
  bulkSetTaskAssigneeAction,
  bulkSetTaskPriorityAction,
  bulkSetTaskStatusAction,
} from "@/lib/actions/tasks";
import {
  CONTENT_TYPE_LABEL,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUSES,
  taskWeightBadgeClass,
} from "@/lib/constants";
import { getActionErrorMessage } from "@/lib/errorMessage";
import {
  LIST_SORT_HINT,
  nextSort,
  sortTasksForList,
  type ListSort,
  type ListSortKey,
} from "@/lib/taskSort";
import type { Person, TaskPriority, TaskStatus, TaskWithContext } from "@/lib/types";
import {
  MAX_COLUMN_WIDTH,
  MIN_COLUMN_WIDTH,
  type TaskListLayout,
} from "@/lib/useTaskListColumns";

const UNASSIGN = "__none__";

const barSelectClass =
  "min-h-9 rounded-md border border-border-default bg-surface px-2 py-1 text-xs text-foreground outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:opacity-50";

export type ListColumn = ListSortKey;

export const DEFAULT_TASK_LIST_COLUMNS: readonly ListColumn[] = [
  "gorev",
  "marka",
  "oncelik",
  "puan",
  "durum",
  "atanan",
  "teslim",
];

const COLUMN_OPTIONS: readonly { key: ListColumn; label: string }[] = [
  { key: "gorev", label: "Görev" },
  { key: "marka", label: "Marka" },
  { key: "oncelik", label: "Öncelik" },
  { key: "durum", label: "Durum" },
  { key: "atanan", label: "Atanan" },
  { key: "teslim", label: "Teslim" },
  { key: "tur", label: "Tür" },
  { key: "puan", label: "Puan" },
  // Filtre paneli, görev detayı ve kart rozeti hep "Zorluk" diyor; sütun
  // başlığının tek başına "İş yükü" demesi aynı alanı iki isimle anlatıyordu.
  { key: "zorluk", label: "Zorluk" },
  { key: "revize", label: "Revize" },
  { key: "hedef", label: "Hedef teslim" },
  { key: "yorum", label: "Yorum" },
];

/**
 * Sütunların VARSAYILAN ekran sırası — kullanıcı başlıkları sürükleyerek
 * değiştirene kadar geçerli. `COLUMN_OPTIONS`'tan ayrı: orası seçim listesinin
 * sırası (sık kullanılanlar üstte), burası tablodaki okuma sırası (iş → bağlam
 * → planlama → sahiplik → tarih).
 */
export const ALL_TASK_LIST_COLUMNS: readonly ListColumn[] = [
  "gorev",
  "tur",
  "marka",
  "oncelik",
  "zorluk",
  "puan",
  "revize",
  "durum",
  "atanan",
  "teslim",
  "hedef",
  "yorum",
];

const COLUMN_LABEL: Record<ListColumn, string> = Object.fromEntries(
  COLUMN_OPTIONS.map((option) => [option.key, option.label]),
) as Record<ListColumn, string>;

// Kullanıcı elle değiştirene kadar geçerli genişlikler (px). Tablo
// `table-fixed` olduğu için bunlar öneri değil, gerçek sütun genişliği.
const DEFAULT_COLUMN_WIDTH: Record<ListColumn, number> = {
  gorev: 300,
  tur: 96,
  marka: 150,
  oncelik: 128,
  zorluk: 132,
  puan: 76,
  revize: 128,
  durum: 148,
  atanan: 184,
  teslim: 132,
  hedef: 132,
  yorum: 84,
};

/** Seçim kutusu sütunu; sürüklenmez, yeniden boyutlandırılmaz. */
const SELECT_COLUMN_WIDTH = 40;

export function TaskListColumnsControl({
  visibleColumns,
  onChange,
  onResetLayout,
}: {
  visibleColumns: ReadonlySet<ListColumn>;
  onChange: (columns: ReadonlySet<ListColumn>) => void;
  /** Sürükleyerek değiştirilen sıra ve elle verilen genişlikleri sıfırlar. */
  onResetLayout?: () => void;
}) {
  function toggleColumn(key: ListColumn) {
    const next = new Set(visibleColumns);
    if (next.has(key)) {
      if (key !== "gorev") next.delete(key);
    } else {
      next.add(key);
    }
    onChange(next);
  }

  return (
    <details className="group relative">
      <summary className="ui-press flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-md border border-border-default bg-surface px-3 text-[13px] font-semibold text-muted hover:bg-surface-hover hover:text-foreground md:min-h-10">
        <Icon name="settings" className="size-4" />
        Sütunlar · {visibleColumns.size}
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-52 rounded-xl border border-border-default bg-surface-elevated p-2 shadow-lg">
        <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted">
          Görünen sütunlar
        </p>
        {COLUMN_OPTIONS.map((column) => (
          <label
            key={column.key}
            className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 text-xs text-secondary hover:bg-surface-hover"
          >
            <input
              type="checkbox"
              checked={visibleColumns.has(column.key)}
              disabled={column.key === "gorev"}
              onChange={() => toggleColumn(column.key)}
              className="accent-brand-600"
            />
            {column.label}
          </label>
        ))}
        <p className="mt-1 border-t border-border-subtle px-2 pt-2 text-[10px] leading-4 text-muted">
          Başlığı sürükleyerek sütunu taşı, sağ kenarından çekerek genişliğini
          ayarla.
        </p>
        <button
          type="button"
          onClick={() => {
            onChange(new Set(DEFAULT_TASK_LIST_COLUMNS));
            onResetLayout?.();
          }}
          className="mt-1 min-h-9 w-full rounded-md px-2 text-left text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/30"
        >
          Varsayılana dön
        </button>
      </div>
    </details>
  );
}

// Tıklanabilir sütun başlığı. Bileşen olarak DIŞARIDA tanımlı: içeride
// tanımlansaydı her render'da yeni bir tip olacağı için React başlığı yeniden
// mount eder, klavyeyle sıralayan kullanıcı odağı kaybederdi.
function SortableTh({
  column,
  label,
  sort,
  onToggle,
  onMove,
  onResize,
  dropTarget,
  onDropTargetChange,
}: {
  column: ListSortKey;
  label: string;
  sort: ListSort | null;
  onToggle: (key: ListSortKey) => void;
  onMove: (dragged: ListSortKey, target: ListSortKey) => void;
  onResize: (column: ListSortKey, event: React.PointerEvent<HTMLElement>) => void;
  dropTarget: ListSortKey | null;
  onDropTargetChange: (column: ListSortKey | null) => void;
}) {
  const active = sort?.key === column;
  return (
    <th
      // Sürükleme `<th>`'nin kendisinde: sıralama düğmesi tek tıkla hâlâ
      // çalışır (HTML5 drag yalnız basılı tutup sürüklerken başlar).
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", column);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        onDropTargetChange(column);
      }}
      onDragLeave={() => onDropTargetChange(null)}
      onDrop={(event) => {
        event.preventDefault();
        const dragged = event.dataTransfer.getData("text/plain") as ListSortKey;
        onDropTargetChange(null);
        if (dragged) onMove(dragged, column);
      }}
      onDragEnd={() => onDropTargetChange(null)}
      className={`relative select-none px-3 py-2 font-medium ${
        dropTarget === column ? "bg-brand-500/10" : ""
      }`}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onToggle(column)}
        title={`${LIST_SORT_HINT[column]} · başlığı sürükleyerek sütunu taşıyabilirsin`}
        className={`group inline-flex max-w-full cursor-grab items-center gap-1 uppercase tracking-wider transition-colors hover:text-foreground active:cursor-grabbing ${
          active ? "text-brand-600 dark:text-brand-400" : ""
        }`}
      >
        <span className="truncate">{label}</span>
        <span
          className={`shrink-0 text-[10px] leading-none ${
            active ? "" : "opacity-0 transition-opacity group-hover:opacity-40"
          }`}
          aria-hidden
        >
          {active && sort.dir === "desc" ? "▼" : "▲"}
        </span>
      </button>
      {/* Genişlik tutamağı. `role="separator"` + aria-orientation: ekran
          okuyucu bunu sütun ayırıcısı olarak duyurur. */}
      <span
        role="separator"
        aria-orientation="vertical"
        aria-label={`${label} sütun genişliği`}
        onPointerDown={(event) => onResize(column, event)}
        onDragStart={(event) => event.preventDefault()}
        className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize bg-transparent transition-colors hover:bg-brand-500/40"
      />
    </th>
  );
}

export default function TaskListView({
  tasks,
  people,
  canDeleteTasks = false,
  visibleColumns: controlledVisibleColumns,
  onVisibleColumnsChange,
  layout,
  showColumnsControl = true,
}: {
  tasks: TaskWithContext[];
  people: Person[];
  canDeleteTasks?: boolean;
  /** Sütun sırası + genişlikleri (bkz. `useTaskListColumns`). Verilmezse
      varsayılan sırada ve genişlikte, kalıcılık olmadan çalışır. */
  layout?: TaskListLayout;
  visibleColumns?: ReadonlySet<ListColumn>;
  onVisibleColumnsChange?: (columns: ReadonlySet<ListColumn>) => void;
  showColumnsControl?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Geri alma penceresi boyunca satırlar listeden İYİMSER olarak düşürülür;
  // silme işlemi süre dolana kadar sunucuya hiç gitmez (bkz. lib/undoQueue.ts).
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());
  const [prevTasks, setPrevTasks] = useState(tasks);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // null = sunucudan gelen varsayılan sıra (öncelik → teslim tarihi → marka).
  const [sort, setSort] = useState<ListSort | null>(null);
  const [localVisibleColumns, setLocalVisibleColumns] = useState<ReadonlySet<ListColumn>>(
    () => new Set(DEFAULT_TASK_LIST_COLUMNS),
  );
  const visibleColumns = controlledVisibleColumns ?? localVisibleColumns;
  const setVisibleColumns = onVisibleColumnsChange ?? setLocalVisibleColumns;
  // Sürüklenen sütunun bırakılacağı hedef (yalnız vurgu için) ve boyutlandırma
  // sırasındaki geçici genişlik. Geçici tutulmasının sebebi: her pointermove'da
  // depoya yazmak yerine yalnız bırakıldığında bir kez yazmak.
  const [dropTarget, setDropTarget] = useState<ListColumn | null>(null);
  const [draftWidth, setDraftWidth] = useState<{ column: ListColumn; width: number } | null>(null);
  const columnOrder = layout?.order ?? ALL_TASK_LIST_COLUMNS;
  const orderedColumns = useMemo(
    () => columnOrder.filter((column) => visibleColumns.has(column)),
    [columnOrder, visibleColumns],
  );
  const widthOf = (column: ListColumn): number =>
    draftWidth?.column === column
      ? draftWidth.width
      : layout?.widths[column] ?? DEFAULT_COLUMN_WIDTH[column];
  const tableWidth =
    SELECT_COLUMN_WIDTH + orderedColumns.reduce((total, column) => total + widthOf(column), 0);


  // Hücre içerikleri sütun ANAHTARINA göre üretiliyor: sıra kullanıcıdan
  // geldiği için başlıklar ve hücreler artık elle yazılmış sabit bir dizilim
  // paylaşamıyor, ikisi de aynı `orderedColumns` listesini geziyor.
  function renderCell(column: ListColumn, t: TaskWithContext) {
    switch (column) {
      case "gorev":
        return (
          <>
            <Link
              href={`/tasks/${t.id}`}
              className="line-clamp-2 font-medium hover:text-brand-600 dark:hover:text-brand-400"
            >
              {t.title}
            </Link>
            <div className="truncate text-xs text-muted">{t.content_title}</div>
          </>
        );
      case "tur":
        return (
          <span className="inline-block max-w-full truncate rounded-md bg-surface-muted px-2 py-1 text-xs font-medium text-secondary">
            {CONTENT_TYPE_LABEL[t.content_type]}
          </span>
        );
      case "marka":
        return <span className="block truncate font-display font-medium text-secondary">{t.brand_name}</span>;
      case "oncelik":
        return <TaskPrioritySelect taskId={t.id} priority={t.priority} />;
      // Puan kendi sütununda; zorluk hücresine gömülü rozet olarak DA
      // göstermek aynı sayıyı iki kez yazmak olurdu (üstelik başlıksız,
      // sıralanamaz halde).
      case "zorluk":
        return <TaskDifficultySelect taskId={t.id} difficulty={t.difficulty} />;
      case "puan":
        return (
          <span className={`inline-block whitespace-nowrap rounded-md px-2 py-1 text-xs font-semibold tabular-nums ${taskWeightBadgeClass(t.weight_points)}`}>
            {t.weight_points}
          </span>
        );
      case "revize":
        return (
          <div className="flex min-w-0 flex-col items-start gap-1">
            {t.status === "Incelemede" && t.pending_delivery_id && t.pending_delivery_version && (
              <TaskQuickRevisionDialog
                taskTitle={t.title}
                deliveryId={t.pending_delivery_id}
                deliveryVersion={t.pending_delivery_version}
              />
            )}
            {t.revision_count > 0 ? (
              <Link href={`/tasks/${t.id}`} className={`inline-flex max-w-full items-center gap-1 truncate text-xs font-semibold ${isRevisionOverTarget(t.active_revision_elapsed_minutes, t.active_revision_target_minutes) ? "text-danger" : t.active_revision_id ? "text-violet-700 dark:text-violet-300" : "text-secondary"}`}>
                R{t.revision_count}
                <span className="font-normal text-muted">· {formatRevisionDuration(t.active_revision_elapsed_minutes ?? t.total_revision_minutes)}</span>
              </Link>
            ) : !t.pending_delivery_id ? <span className="text-muted">—</span> : null}
          </div>
        );
      case "durum":
        return <TaskStatusSelect taskId={t.id} status={t.status} />;
      case "atanan":
        return (
          <div className="flex min-w-0 items-center gap-2">
            {t.assignee_name && (
              <PersonAvatar
                name={t.assignee_name}
                avatarPath={t.assignee_avatar_path}
                size="xs"
              />
            )}
            <AssigneeSelect taskId={t.id} assigneeId={t.assignee_id} people={people} />
          </div>
        );
      case "teslim":
        return <TaskDueDateEdit taskId={t.id} dueDate={t.due_date} />;
      // Kişisel hedef yalnızca görev SANA atanmışsa taşınır (alan undefined
      // ise başkasının işi) — o zaman düzenleme değil düz bir tire gösterilir.
      // Yayınlanmış görevde de düzenleme kapalı: sunucu yeni hedef yazmayı
      // reddediyor.
      case "hedef":
        return t.personal_target_date !== undefined && t.status !== "Yayinlandi" ? (
          <TaskTargetDateEdit taskId={t.id} targetDate={t.personal_target_date} />
        ) : t.personal_target_date ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-brand-600 dark:text-brand-300">
            <Icon name="clock" className="size-3.5" /> {formatDateShort(t.personal_target_date)}
          </span>
        ) : (
          <span className="text-faint">—</span>
        );
      // Yorum sütunu: sayı + son yorumun metni `title` içinde, üstüne gelince
      // tam metin okunur. Tıklayınca sağda panel açılır.
      case "yorum":
        return t.comment_count > 0 ? (
          <button
            type="button"
            onClick={() => setOpenComments({ id: t.id, title: t.title })}
            title={
              t.last_comment_body
                ? `${t.last_comment_author ?? "?"}: ${t.last_comment_body}`
                : undefined
            }
            className="inline-flex items-center gap-1 text-xs text-secondary hover:text-brand-600 dark:hover:text-brand-300"
          >
            <CommentIcon />
            <span className="tabular-nums">{t.comment_count}</span>
          </button>
        ) : (
          <span className="text-muted">—</span>
        );
    }
  }
  function beginResize(column: ListColumn, event: React.PointerEvent<HTMLElement>) {
    if (!layout) return;
    event.preventDefault();
    event.stopPropagation();
    const handle = event.currentTarget;
    const startX = event.clientX;
    const startWidth = widthOf(column);
    const clamp = (value: number) =>
      Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(value)));
    handle.setPointerCapture(event.pointerId);

    const onMove = (moveEvent: PointerEvent) => {
      setDraftWidth({ column, width: clamp(startWidth + moveEvent.clientX - startX) });
    };
    const onUp = (upEvent: PointerEvent) => {
      handle.releasePointerCapture(upEvent.pointerId);
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
      setDraftWidth(null);
      layout.setWidth(column, clamp(startWidth + upEvent.clientX - startX));
    };

    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  }
  // Yorum sütununa tıklayınca açılan sağ panel — hangi görevin yorumları
  // gösteriliyor. null = kapalı.
  const [openComments, setOpenComments] = useState<{ id: string; title: string } | null>(null);
  // Satıra sağ tık: panodaki kartla AYNI işlem menüsü (bkz. TaskContextMenu).
  const contextMenu = useTaskContextMenu();

  // tasks prop değişince (filtre değişimi ya da AutoRefresh) seçimi hâlâ var
  // olan görevlere buda — silinmiş/filtrelenmiş id'ler seçili kalmasın.
  if (tasks !== prevTasks) {
    setPrevTasks(tasks);
    const present = new Set(tasks.map((t) => t.id));
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => present.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }

  const visibleTasks = useMemo(
    () => (hiddenIds.size === 0 ? tasks : tasks.filter((task) => !hiddenIds.has(task.id))),
    [tasks, hiddenIds],
  );
  const allSelected = visibleTasks.length > 0 && selected.size === visibleTasks.length;
  const someSelected = selected.size > 0;
  const ids = useMemo(() => [...selected], [selected]);

  function deleteSelected() {
    const doomed = new Set(ids);
    setHiddenIds((prev) => new Set([...prev, ...doomed]));
    setSelected(new Set());
    runUndoable({
      message: `${doomed.size} görev silindi`,
      commit: () => run(() => bulkDeleteTasksAction([...doomed])),
      rollback: () => {
        setHiddenIds((prev) => new Set([...prev].filter((id) => !doomed.has(id))));
        setSelected(doomed);
      },
    });
  }

  // Sıralama yalnızca görüntüleme sırasını değiştirir; seçim id bazlı olduğu
  // için sütun değiştirmek seçimi bozmaz.
  const rows = useMemo(
    () => (sort ? sortTasksForList(visibleTasks, sort) : visibleTasks),
    [visibleTasks, sort],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visibleTasks.map((t) => t.id)));
  }

  function toggleSort(key: ListSortKey) {
    setSort((prev) => nextSort(prev, key));
  }

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        setSelected(new Set());
      } catch (e) {
        setError(getActionErrorMessage(e));
      }
    });
  }

  return (
    <div className="space-y-3">
      {someSelected && (
        <div className="sticky top-[var(--header-h)] z-10 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/90 p-2 text-sm shadow-[0_8px_28px_rgb(35_30_24/0.10)] backdrop-blur dark:border-brand-900/60 dark:bg-brand-950/70">
          <span className="px-1 font-medium text-brand-700 dark:text-brand-300">
            {selected.size} seçili
          </span>

          <select
            aria-label="Toplu durum"
            disabled={pending}
            value=""
            onChange={(e) => {
              const v = e.target.value as TaskStatus;
              e.currentTarget.value = "";
              if (v) run(() => bulkSetTaskStatusAction(ids, v));
            }}
            className={barSelectClass}
          >
            <option value="" disabled>
              Durum değiştir…
            </option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {TASK_STATUS_LABEL[s]}
              </option>
            ))}
          </select>

          <select
            aria-label="Toplu öncelik"
            disabled={pending}
            value=""
            onChange={(e) => {
              const v = e.target.value as TaskPriority;
              e.currentTarget.value = "";
              if (v) run(() => bulkSetTaskPriorityAction(ids, v));
            }}
            className={barSelectClass}
          >
            <option value="" disabled>
              Öncelik değiştir…
            </option>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {TASK_PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>

          <select
            aria-label="Toplu atama"
            disabled={pending}
            value=""
            onChange={(e) => {
              const v = e.target.value;
              e.currentTarget.value = "";
              if (v) run(() => bulkSetTaskAssigneeAction(ids, v === UNASSIGN ? null : v));
            }}
            className={barSelectClass}
          >
            <option value="" disabled>
              Ata…
            </option>
            <option value={UNASSIGN}>— Atamayı kaldır —</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {canDeleteTasks && (
            <button
              type="button"
              disabled={pending}
              onClick={deleteSelected}
              className="ui-press rounded-md px-2 py-1 text-xs font-medium text-danger hover:bg-rose-100 disabled:opacity-50 dark:hover:bg-rose-950/40"
            >
              Sil
            </button>
          )}

          {pending && <span className="text-xs text-brand-600 dark:text-brand-400">İşleniyor…</span>}

          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs font-medium text-muted hover:text-foreground"
          >
            Seçimi temizle
          </button>
        </div>
      )}

      {error && <p role="alert" className="text-xs text-danger">{error}</p>}

      <div className="flex items-center justify-between gap-3 md:hidden">
        <span className="text-xs text-muted">{rows.length} görev</span>
        <button
          type="button"
          onClick={toggleAll}
          className="ui-press min-h-11 rounded-md border border-border-default bg-surface px-3 text-xs font-semibold text-secondary"
        >
          {allSelected ? "Seçimi kaldır" : "Tümünü seç"}
        </button>
      </div>

      <div className="grid gap-2 md:hidden">
        {rows.map((t) => {
          const isSel = selected.has(t.id);
          return (
            <article
              key={t.id}
              data-brand-accent
              style={brandAccentStyle(t.brand_accent_hue)}
              onContextMenu={(event) => contextMenu.open(event, {
                id: t.id,
                title: t.title,
                archived: t.archived_at !== null,
                status: t.status,
              })}
              className={`brand-stripe min-w-0 max-w-full overflow-hidden rounded-r-xl border border-border-default bg-surface p-3 ${
                isSel ? "bg-brand-50/60 dark:bg-brand-950/20" : ""
              }`}
            >
              <header className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={isSel}
                  onChange={() => toggle(t.id)}
                  aria-label={`${t.title} seç`}
                  className="mt-1 cursor-pointer accent-brand-600"
                />
                <span className="min-w-0 flex-1">
                  <Link
                    href={`/tasks/${t.id}`}
                    className="block font-display text-sm font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-300"
                  >
                    {t.title}
                  </Link>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {t.brand_name} · {t.content_title}
                  </span>
                </span>
                {t.comment_count > 0 && (
                  <button
                    type="button"
                    onClick={() => setOpenComments({ id: t.id, title: t.title })}
                    title={t.last_comment_body ?? undefined}
                    className="ui-press inline-flex min-h-9 min-w-9 items-center justify-center gap-1 rounded-md text-xs text-secondary hover:bg-surface-hover hover:text-brand-600"
                    aria-label={`${t.title} yorumlarını aç`}
                  >
                    <CommentIcon />
                    <span className="tabular-nums">{t.comment_count}</span>
                  </button>
                )}
              </header>

              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="rounded-md bg-surface-muted px-2 py-1 font-medium text-secondary">
                  {CONTENT_TYPE_LABEL[t.content_type]}
                </span>
                <span className="rounded-md bg-surface-muted px-2 py-1 font-semibold tabular-nums text-secondary">
                  {t.difficulty ? `${t.difficulty} · ` : ""}{t.weight_points} puan
                </span>
                {t.revision_count > 0 && (
                  <Link
                    href={`/tasks/${t.id}`}
                    className={`rounded-md bg-surface-muted px-2 py-1 font-semibold ${
                      isRevisionOverTarget(t.active_revision_elapsed_minutes, t.active_revision_target_minutes)
                        ? "text-danger"
                        : "text-secondary"
                    }`}
                  >
                    R{t.revision_count} · {formatRevisionDuration(t.active_revision_elapsed_minutes ?? t.total_revision_minutes)}
                  </Link>
                )}
              </div>

              <div className="mt-3 grid min-w-0 grid-cols-1 gap-2 border-t border-border-subtle pt-3 min-[360px]:grid-cols-2 [&>*]:min-w-0">
                <TaskPrioritySelect taskId={t.id} priority={t.priority} />
                <TaskStatusSelect taskId={t.id} status={t.status} />
                <AssigneeSelect taskId={t.id} assigneeId={t.assignee_id} people={people} />
                <TaskDueDateEdit taskId={t.id} dueDate={t.due_date} />
              </div>

              {(t.personal_target_date !== undefined || t.pending_delivery_id) && (
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border-subtle pt-2">
                  {t.personal_target_date !== undefined && t.status !== "Yayinlandi" ? (
                    <TaskTargetDateEdit taskId={t.id} targetDate={t.personal_target_date} />
                  ) : t.personal_target_date ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-300">
                      <Icon name="clock" className="size-3.5" /> {formatDateShort(t.personal_target_date)}
                    </span>
                  ) : null}
                  {t.status === "Incelemede" && t.pending_delivery_id && t.pending_delivery_version && (
                    <TaskQuickRevisionDialog
                      taskTitle={t.title}
                      deliveryId={t.pending_delivery_id}
                      deliveryVersion={t.pending_delivery_version}
                    />
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {showColumnsControl && (
        <div className="hidden items-center justify-end md:flex">
          <TaskListColumnsControl visibleColumns={visibleColumns} onChange={setVisibleColumns} />
        </div>
      )}

      {/* `table-fixed`: sütun genişlikleri gerçekten uygulansın (auto layout'ta
          içerik genişliği kazanır, kullanıcının elle verdiği ölçü tutmaz).
          Genişlik toplamı tablo genişliğini belirliyor; taşarsa kapsayıcı
          yatay kaydırıyor. */}
      <div className="hidden overflow-x-auto rounded-xl border border-border-default bg-surface md:block">
        <table className="w-full table-fixed text-sm" style={{ minWidth: tableWidth }}>
          <colgroup>
            <col style={{ width: SELECT_COLUMN_WIDTH }} />
            {orderedColumns.map((column) => (
              <col key={column} style={{ width: widthOf(column) }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-border-default text-left text-xs uppercase tracking-wider text-muted">
              <th className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected && !allSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="Tümünü seç"
                  className="cursor-pointer accent-brand-600"
                />
              </th>
              {orderedColumns.map((column) => (
                <SortableTh
                  key={column}
                  column={column}
                  label={COLUMN_LABEL[column]}
                  sort={sort}
                  onToggle={toggleSort}
                  onMove={(dragged, target) => layout?.moveColumn(dragged, target)}
                  onResize={beginResize}
                  dropTarget={dropTarget}
                  onDropTargetChange={setDropTarget}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const isSel = selected.has(t.id);
              return (
                <tr
                  key={t.id}
                  data-brand-accent
                  style={brandAccentStyle(t.brand_accent_hue)}
                  onContextMenu={(event) => contextMenu.open(event, {
                    id: t.id,
                    title: t.title,
                    archived: t.archived_at !== null,
                    status: t.status,
                  })}
                  className={`group border-b border-border-subtle last:border-0 ${
                    isSel ? "bg-brand-50/60 dark:bg-brand-950/20" : ""
                  }`}
                >
                  <td className="border-l-[3px] border-l-[var(--brand-accent)] px-3 py-2 align-top transition-[border-width] group-hover:border-l-4">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggle(t.id)}
                      aria-label={`${t.title} seç`}
                      className="mt-0.5 cursor-pointer accent-brand-600"
                    />
                  </td>
                  {orderedColumns.map((column) => (
                    <td key={column} className="px-3 py-2 align-middle">
                      {renderCell(column, t)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {contextMenu.state && (
        <TaskContextMenu
          target={contextMenu.state.target}
          position={contextMenu.state.position}
          canDelete={canDeleteTasks}
          onClose={contextMenu.close}
        />
      )}

      {openComments && (
        <TaskCommentsPanel
          taskId={openComments.id}
          taskTitle={openComments.title}
          people={people}
          onClose={() => setOpenComments(null)}
        />
      )}
    </div>
  );
}
