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

const UNASSIGN = "__none__";

const barSelectClass =
  "min-h-9 rounded-md border border-border-default bg-surface px-2 py-1 text-xs text-foreground outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/15 disabled:opacity-50";

export type ListColumn = ListSortKey;

export const DEFAULT_TASK_LIST_COLUMNS: readonly ListColumn[] = [
  "gorev",
  "marka",
  "oncelik",
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
  { key: "zorluk", label: "İş yükü" },
  { key: "revize", label: "Revize" },
  { key: "hedef", label: "Hedef teslim" },
  { key: "yorum", label: "Yorum" },
];

export function TaskListColumnsControl({
  visibleColumns,
  onChange,
}: {
  visibleColumns: ReadonlySet<ListColumn>;
  onChange: (columns: ReadonlySet<ListColumn>) => void;
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
        <button
          type="button"
          onClick={() => onChange(new Set(DEFAULT_TASK_LIST_COLUMNS))}
          className="mt-1 min-h-9 w-full rounded-md border-t border-border-subtle px-2 text-left text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/30"
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
}: {
  column: ListSortKey;
  label: string;
  sort: ListSort | null;
  onToggle: (key: ListSortKey) => void;
}) {
  const active = sort?.key === column;
  return (
    <th
      className="px-3 py-2 font-medium"
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onToggle(column)}
        title={LIST_SORT_HINT[column]}
        className={`group inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-foreground ${
          active ? "text-brand-600 dark:text-brand-400" : ""
        }`}
      >
        {label}
        <span
          className={`text-[10px] leading-none ${
            active ? "" : "opacity-0 transition-opacity group-hover:opacity-40"
          }`}
          aria-hidden
        >
          {active && sort.dir === "desc" ? "▼" : "▲"}
        </span>
      </button>
    </th>
  );
}

export default function TaskListView({
  tasks,
  people,
  canDeleteTasks = false,
  visibleColumns: controlledVisibleColumns,
  onVisibleColumnsChange,
  showColumnsControl = true,
}: {
  tasks: TaskWithContext[];
  people: Person[];
  canDeleteTasks?: boolean;
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

      <div className="hidden overflow-x-auto rounded-xl border border-border-default bg-surface md:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border-default text-left text-xs uppercase tracking-wider text-muted">
              <th className="w-10 px-3 py-2">
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
              {visibleColumns.has("gorev") && <SortableTh column="gorev" label="Görev" sort={sort} onToggle={toggleSort} />}
              {visibleColumns.has("tur") && <SortableTh column="tur" label="Tür" sort={sort} onToggle={toggleSort} />}
              {visibleColumns.has("marka") && <SortableTh column="marka" label="Marka" sort={sort} onToggle={toggleSort} />}
              {visibleColumns.has("oncelik") && <SortableTh column="oncelik" label="Öncelik" sort={sort} onToggle={toggleSort} />}
              {visibleColumns.has("zorluk") && <SortableTh column="zorluk" label="İş yükü" sort={sort} onToggle={toggleSort} />}
              {visibleColumns.has("revize") && <SortableTh column="revize" label="Revize" sort={sort} onToggle={toggleSort} />}
              {visibleColumns.has("durum") && <SortableTh column="durum" label="Durum" sort={sort} onToggle={toggleSort} />}
              {visibleColumns.has("atanan") && <SortableTh column="atanan" label="Atanan" sort={sort} onToggle={toggleSort} />}
              {visibleColumns.has("teslim") && <SortableTh column="teslim" label="Teslim" sort={sort} onToggle={toggleSort} />}
              {visibleColumns.has("hedef") && <SortableTh column="hedef" label="Hedef teslim" sort={sort} onToggle={toggleSort} />}
              {visibleColumns.has("yorum") && <SortableTh column="yorum" label="Yorum" sort={sort} onToggle={toggleSort} />}
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
                  {visibleColumns.has("gorev") && <td className="px-3 py-2">
                    <Link
                      href={`/tasks/${t.id}`}
                      className="font-medium hover:text-brand-600 dark:hover:text-brand-400 dark:hover:text-brand-400"
                    >
                      {t.title}
                    </Link>
                    <div className="text-xs text-muted">{t.content_title}</div>
                  </td>}
                  {visibleColumns.has("tur") && <td className="px-3 py-2">
                    <span className="whitespace-nowrap rounded-md bg-surface-muted px-2 py-1 text-xs font-medium text-secondary">
                      {CONTENT_TYPE_LABEL[t.content_type]}
                    </span>
                  </td>}
                  {visibleColumns.has("marka") && <td className="px-3 py-2 font-display font-medium text-secondary">{t.brand_name}</td>}
                  {visibleColumns.has("oncelik") && <td className="px-3 py-2">
                    <TaskPrioritySelect taskId={t.id} priority={t.priority} />
                  </td>}
                  {visibleColumns.has("zorluk") && <td className="px-3 py-2">
                    <div className="flex min-w-[7.5rem] items-center gap-1.5">
                      <TaskDifficultySelect taskId={t.id} difficulty={t.difficulty} />
                      <span className="whitespace-nowrap rounded-md bg-surface-subtle px-2 py-1 text-xs font-semibold tabular-nums text-secondary">{t.weight_points} puan</span>
                    </div>
                  </td>}
                  {visibleColumns.has("revize") && <td className="px-3 py-2">
                    <div className="flex min-w-[7rem] flex-col items-start gap-1">
                      {t.status === "Incelemede" && t.pending_delivery_id && t.pending_delivery_version && (
                        <TaskQuickRevisionDialog
                          taskTitle={t.title}
                          deliveryId={t.pending_delivery_id}
                          deliveryVersion={t.pending_delivery_version}
                        />
                      )}
                      {t.revision_count > 0 ? (
                        <Link href={`/tasks/${t.id}`} className={`inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold ${isRevisionOverTarget(t.active_revision_elapsed_minutes, t.active_revision_target_minutes) ? "text-danger" : t.active_revision_id ? "text-violet-700 dark:text-violet-300" : "text-secondary"}`}>
                          R{t.revision_count}
                          <span className="font-normal text-muted">· {formatRevisionDuration(t.active_revision_elapsed_minutes ?? t.total_revision_minutes)}</span>
                        </Link>
                      ) : !t.pending_delivery_id ? <span className="text-muted">—</span> : null}
                    </div>
                  </td>}
                  {visibleColumns.has("durum") && <td className="px-3 py-2">
                    <TaskStatusSelect taskId={t.id} status={t.status} />
                  </td>}
                  {visibleColumns.has("atanan") && <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      {t.assignee_name && (
                        <PersonAvatar
                          name={t.assignee_name}
                          avatarPath={t.assignee_avatar_path}
                          size="xs"
                        />
                      )}
                      <AssigneeSelect
                        taskId={t.id}
                        assigneeId={t.assignee_id}
                        people={people}
                      />
                    </div>
                  </td>}
                  {visibleColumns.has("teslim") && <td className="px-3 py-2">
                    <TaskDueDateEdit taskId={t.id} dueDate={t.due_date} />
                  </td>}
                  {/* Kişisel hedef yalnızca görev SANA atanmışsa taşınır
                      (alan undefined ise başkasının işi) — o zaman düzenleme
                      değil düz bir tire gösterilir. Yayınlanmış görevde de
                      düzenleme kapalı: sunucu yeni hedef yazmayı reddediyor. */}
                  {visibleColumns.has("hedef") && <td className="px-3 py-2">
                    {t.personal_target_date !== undefined && t.status !== "Yayinlandi" ? (
                      <TaskTargetDateEdit taskId={t.id} targetDate={t.personal_target_date} />
                    ) : t.personal_target_date ? (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-brand-600 dark:text-brand-300">
                        <Icon name="clock" className="size-3.5" /> {formatDateShort(t.personal_target_date)}
                      </span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </td>}
                  {/* Yorum sütunu: sayı + son yorumun metni `title` içinde,
                      üstüne gelince tam metin okunur. Tıklayınca sağda panel
                      açılır (görev sayfasına gitmeye gerek kalmadan). */}
                  {visibleColumns.has("yorum") && <td className="px-3 py-2">
                    {t.comment_count > 0 ? (
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
                    )}
                  </td>}
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
