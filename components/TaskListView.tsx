"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import AssigneeSelect from "@/components/AssigneeSelect";
import CommentIcon from "@/components/CommentIcon";
import PersonAvatar from "@/components/PersonAvatar";
import TaskCommentsPanel from "@/components/TaskCommentsPanel";
import TaskDueDateEdit from "@/components/TaskDueDateEdit";
import TaskDifficultySelect from "@/components/TaskDifficultySelect";
import TaskPrioritySelect from "@/components/TaskPrioritySelect";
import TaskQuickRevisionDialog from "@/components/TaskQuickRevisionDialog";
import TaskStatusSelect from "@/components/TaskStatusSelect";
import TaskTargetDateEdit from "@/components/TaskTargetDateEdit";
import Icon from "@/components/ui/Icon";
import { formatDateShort } from "@/lib/date";
import { formatRevisionDuration, isRevisionOverTarget } from "@/lib/taskMetadata";
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
  "rounded-md border border-black/10 bg-white px-2 py-1 text-xs outline-none focus:border-brand-500 disabled:opacity-50 dark:border-white/15 dark:bg-zinc-900";

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
        className={`group inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-zinc-700 dark:hover:text-zinc-200 ${
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
}: {
  tasks: TaskWithContext[];
  people: Person[];
  canDeleteTasks?: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [prevTasks, setPrevTasks] = useState(tasks);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // null = sunucudan gelen varsayılan sıra (öncelik → teslim tarihi → marka).
  const [sort, setSort] = useState<ListSort | null>(null);
  // Yorum sütununa tıklayınca açılan sağ panel — hangi görevin yorumları
  // gösteriliyor. null = kapalı.
  const [openComments, setOpenComments] = useState<{ id: string; title: string } | null>(null);

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

  const allSelected = tasks.length > 0 && selected.size === tasks.length;
  const someSelected = selected.size > 0;
  const ids = useMemo(() => [...selected], [selected]);

  // Sıralama yalnızca görüntüleme sırasını değiştirir; seçim id bazlı olduğu
  // için sütun değiştirmek seçimi bozmaz.
  const rows = useMemo(() => (sort ? sortTasksForList(tasks, sort) : tasks), [tasks, sort]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(tasks.map((t) => t.id)));
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
        <div className="sticky top-[var(--header-h)] z-10 flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/90 p-2 text-sm shadow-sm backdrop-blur dark:border-brand-900/60 dark:bg-brand-950/70">
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
              onClick={() => {
                if (
                  confirm(
                    `${selected.size} görev kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`,
                  )
                ) {
                  run(() => bulkDeleteTasksAction(ids));
                }
              }}
              className="rounded-md px-2 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-100 disabled:opacity-50 dark:hover:bg-rose-950/40"
            >
              Sil
            </button>
          )}

          {pending && <span className="text-xs text-brand-600 dark:text-brand-400">İşleniyor…</span>}

          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="ml-auto text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Seçimi temizle
          </button>
        </div>
      )}

      {error && <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      <div className="overflow-x-auto rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900">
        <table className="w-full min-w-[1420px] text-sm">
          <thead>
            <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 dark:border-white/10">
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
              <SortableTh column="gorev" label="Görev" sort={sort} onToggle={toggleSort} />
              <SortableTh column="tur" label="Tür" sort={sort} onToggle={toggleSort} />
              <SortableTh column="marka" label="Marka" sort={sort} onToggle={toggleSort} />
              <SortableTh column="oncelik" label="Öncelik" sort={sort} onToggle={toggleSort} />
              <SortableTh column="zorluk" label="İş yükü" sort={sort} onToggle={toggleSort} />
              <SortableTh column="revize" label="Revize" sort={sort} onToggle={toggleSort} />
              <SortableTh column="durum" label="Durum" sort={sort} onToggle={toggleSort} />
              <SortableTh column="atanan" label="Atanan" sort={sort} onToggle={toggleSort} />
              <SortableTh column="teslim" label="Teslim" sort={sort} onToggle={toggleSort} />
              <SortableTh column="hedef" label="Hedef teslim" sort={sort} onToggle={toggleSort} />
              <SortableTh column="yorum" label="Yorum" sort={sort} onToggle={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => {
              const isSel = selected.has(t.id);
              return (
                <tr
                  key={t.id}
                  className={`border-b border-black/5 last:border-0 dark:border-white/5 ${
                    isSel ? "bg-brand-50/60 dark:bg-brand-950/20" : ""
                  }`}
                >
                  <td className="px-3 py-2 align-top">
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggle(t.id)}
                      aria-label={`${t.title} seç`}
                      className="mt-0.5 cursor-pointer accent-brand-600"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/tasks/${t.id}`}
                      className="font-medium hover:text-brand-600 dark:hover:text-brand-400 dark:hover:text-brand-400"
                    >
                      {t.title}
                    </Link>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{t.content_title}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="whitespace-nowrap rounded-full bg-black/5 px-2 py-1 text-xs font-medium text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
                      {CONTENT_TYPE_LABEL[t.content_type]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">{t.brand_name}</td>
                  <td className="px-3 py-2">
                    <TaskPrioritySelect taskId={t.id} priority={t.priority} />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex min-w-[7.5rem] items-center gap-1.5">
                      <TaskDifficultySelect taskId={t.id} difficulty={t.difficulty} />
                      <span className="whitespace-nowrap rounded-md bg-surface-subtle px-2 py-1 text-xs font-semibold tabular-nums text-secondary">{t.weight_points} puan</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex min-w-[7rem] flex-col items-start gap-1">
                      {t.status === "Incelemede" && t.pending_delivery_id && t.pending_delivery_version && (
                        <TaskQuickRevisionDialog
                          taskTitle={t.title}
                          deliveryId={t.pending_delivery_id}
                          deliveryVersion={t.pending_delivery_version}
                        />
                      )}
                      {t.revision_count > 0 ? (
                        <Link href={`/tasks/${t.id}`} className={`inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold ${isRevisionOverTarget(t.active_revision_elapsed_minutes, t.active_revision_target_minutes) ? "text-danger dark:text-rose-300" : t.active_revision_id ? "text-violet-700 dark:text-violet-300" : "text-secondary"}`}>
                          R{t.revision_count}
                          <span className="font-normal text-muted">· {formatRevisionDuration(t.active_revision_elapsed_minutes ?? t.total_revision_minutes)}</span>
                        </Link>
                      ) : !t.pending_delivery_id ? <span className="text-muted">—</span> : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <TaskStatusSelect taskId={t.id} status={t.status} />
                  </td>
                  <td className="px-3 py-2">
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
                  </td>
                  <td className="px-3 py-2">
                    <TaskDueDateEdit taskId={t.id} dueDate={t.due_date} />
                  </td>
                  {/* Kişisel hedef yalnızca görev SANA atanmışsa taşınır
                      (alan undefined ise başkasının işi) — o zaman düzenleme
                      değil düz bir tire gösterilir. Yayınlanmış görevde de
                      düzenleme kapalı: sunucu yeni hedef yazmayı reddediyor. */}
                  <td className="px-3 py-2">
                    {t.personal_target_date !== undefined && t.status !== "Yayinlandi" ? (
                      <TaskTargetDateEdit taskId={t.id} targetDate={t.personal_target_date} />
                    ) : t.personal_target_date ? (
                      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-brand-600 dark:text-brand-300">
                        <Icon name="clock" className="size-3.5" /> {formatDateShort(t.personal_target_date)}
                      </span>
                    ) : (
                      <span className="text-zinc-400 dark:text-zinc-600">—</span>
                    )}
                  </td>
                  {/* Yorum sütunu: sayı + son yorumun metni `title` içinde,
                      üstüne gelince tam metin okunur. Tıklayınca sağda panel
                      açılır (görev sayfasına gitmeye gerek kalmadan). */}
                  <td className="px-3 py-2">
                    {t.comment_count > 0 ? (
                      <button
                        type="button"
                        onClick={() => setOpenComments({ id: t.id, title: t.title })}
                        title={
                          t.last_comment_body
                            ? `${t.last_comment_author ?? "?"}: ${t.last_comment_body}`
                            : undefined
                        }
                        className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-brand-600 dark:text-zinc-300 dark:hover:text-brand-400"
                      >
                        <CommentIcon />
                        <span className="tabular-nums">{t.comment_count}</span>
                      </button>
                    ) : (
                      <span className="text-zinc-500 dark:text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
