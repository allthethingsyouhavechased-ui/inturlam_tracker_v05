"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useState, useTransition } from "react";
import AssigneeSelect from "@/components/AssigneeSelect";
import PersonAvatar from "@/components/PersonAvatar";
import TaskPrioritySelect from "@/components/TaskPrioritySelect";
import TaskStatusSelect from "@/components/TaskStatusSelect";
import Icon from "@/components/ui/Icon";
import { setTaskStatusAction } from "@/lib/actions/tasks";
import {
  CONTENT_TYPE_LABEL,
  TASK_PRIORITY_BORDER,
  TASK_PRIORITY_FLAG_THRESHOLD,
  TASK_STATUS_BADGE,
  TASK_STATUS_BORDER_TOP,
  TASK_STATUS_DOT,
  TASK_STATUS_LABEL,
  TASK_STATUSES,
} from "@/lib/constants";
import { formatDateShort, isOverdue } from "@/lib/date";
import type { Person, TaskStatus, TaskWithContext } from "@/lib/types";

function TaskCard({
  task,
  people,
  overlay = false,
}: {
  task: TaskWithContext;
  people: Person[];
  overlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      data-dnd-card={overlay ? undefined : ""}
      data-dragging={isDragging || undefined}
      className={`ui-surface touch-none space-y-2 rounded-xl border-2 bg-white p-3 shadow-sm dark:bg-zinc-900 ${TASK_PRIORITY_BORDER[task.priority]} ${
        overlay
          ? "rotate-[1deg] scale-[1.02] cursor-grabbing shadow-2xl"
          : "cursor-grab active:cursor-grabbing hover:shadow-md"
      } ${isDragging && !overlay ? "scale-[0.98] opacity-25" : ""}`}
    >
      <div className="flex items-start gap-2">
        <Link
          href={`/tasks/${task.id}`}
          className="min-w-0 flex-1 text-sm font-medium hover:text-brand-600 dark:hover:text-brand-400"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {TASK_PRIORITY_FLAG_THRESHOLD.includes(task.priority) && (
            <Icon name="alert" className="mr-1 inline size-3.5 text-warning" />
          )}
          {task.title}
        </Link>
        <Link
          href={`/tasks/${task.id}`}
          aria-label={`“${task.title}” görevini düzenle`}
          title="Görevi düzenle"
          className="touch-target shrink-0 rounded-md p-1 text-zinc-400 transition-colors hover:bg-black/5 hover:text-brand-600 dark:text-zinc-500 dark:hover:bg-white/10 dark:hover:text-brand-400"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
            <path
              d="m13.8 3.7 2.5 2.5M4 16l.7-3.2L13.6 4a1.4 1.4 0 0 1 2 0l.4.4a1.4 1.4 0 0 1 0 2l-8.8 8.9L4 16Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        <span className="rounded-full bg-black/5 px-2 py-0.5 dark:bg-white/10">
          {CONTENT_TYPE_LABEL[task.content_type]}
        </span>
        <span className="rounded-full bg-black/5 px-2 py-0.5 tabular-nums dark:bg-white/10">
          {task.weight_points} puan
        </span>
        <span className="min-w-0 truncate normal-case font-medium tracking-normal">
          {task.content_title}
        </span>
      </div>
      {/* Yayınlanan kart bu panodan da hemen düşmüyor; geri sayım burada da
          görünsün ki "kayboldu" hissi hiçbir ekranda oluşmasın. Rozet sunucuda
          hesaplanıp `badges` ile taşınıyor (bkz. archiveCountdownBadge). */}
      {task.badges && task.badges.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.badges.map((badge) => (
            <span
              key={badge.label}
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
            >
              {badge.label}
            </span>
          ))}
        </div>
      )}
      {task.due_date && (
        <div
          className={`text-xs ${isOverdue(task.due_date) ? "font-medium text-rose-600 dark:text-rose-400" : "text-zinc-500 dark:text-zinc-400"}`}
        >
          <span className="inline-flex items-center gap-1"><Icon name="calendar" className="size-3.5" />{formatDateShort(task.due_date)}</span>
        </div>
      )}
      <div
        className="flex flex-wrap items-center gap-1.5"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {task.assignee_name && (
          <PersonAvatar
            name={task.assignee_name}
            avatarPath={task.assignee_avatar_path}
            size="xs"
          />
        )}
        <AssigneeSelect taskId={task.id} assigneeId={task.assignee_id} people={people} />
        <TaskStatusSelect taskId={task.id} status={task.status} />
        <TaskPrioritySelect taskId={task.id} priority={task.priority} />
      </div>
    </div>
  );
}

function Column({
  status,
  tasks,
  people,
}: {
  status: TaskStatus;
  tasks: TaskWithContext[];
  people: Person[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      data-drop-column={status}
      data-drop-active={isOver || undefined}
      className={`min-h-40 space-y-2 rounded-2xl border border-black/5 border-t-2 bg-slate-50/60 p-3 transition-[background-color,border-color,box-shadow,transform] duration-200 dark:border-white/5 dark:bg-white/[0.02] ${TASK_STATUS_BORDER_TOP[status]} ${
        isOver
          ? "scale-[1.01] border-brand-400 bg-brand-50/80 shadow-md ring-2 ring-brand-500/20 dark:border-brand-700 dark:bg-brand-950/30"
          : ""
      }`}
    >
      <div
        className={`flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs font-semibold uppercase tracking-wider ${TASK_STATUS_BADGE[status]}`}
      >
        <span className={`h-2 w-2 rounded-full ${TASK_STATUS_DOT[status]}`} />
        {TASK_STATUS_LABEL[status]}
        <span className="ml-auto rounded-full bg-white/60 px-1.5 py-0.5 tabular-nums dark:bg-black/20">
          {tasks.length}
        </span>
      </div>
      <div className="min-h-20 space-y-2">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} people={people} />
        ))}
        {tasks.length === 0 && (
          <div
            className={`flex min-h-20 items-center justify-center rounded-xl border border-dashed text-center text-xs font-medium transition-colors ${
              isOver
                ? "border-brand-400 bg-white/70 text-brand-700 dark:border-brand-600 dark:bg-black/10 dark:text-brand-300"
                : "border-black/10 text-zinc-500 dark:border-white/10 dark:text-zinc-400"
            }`}
          >
            {isOver ? (
              "Buraya bırak"
            ) : (
              <span>
                Bu aşamada görev yok
                <span className="mt-1 block font-normal opacity-75">
                  Kartı buraya sürükleyebilirsin
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanBoard({
  tasks: initialTasks,
  people,
}: {
  tasks: TaskWithContext[];
  people: Person[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [prevInitialTasks, setPrevInitialTasks] = useState(initialTasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // Sunucudan yeni `tasks` geldiğinde (AutoRefresh, başka bir action) yerel
  // state'i senkronize et — bunu useEffect yerine render sırasında yapmak
  // (React'in "adjusting state when a prop changes" deseni) ekstra bir
  // render turu yaratmıyor.
  if (initialTasks !== prevInitialTasks) {
    setPrevInitialTasks(initialTasks);
    setTasks(initialTasks);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const newStatus = over.id as TaskStatus;
    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );
    startTransition(() => setTaskStatusAction(taskId, newStatus));
  }

  const activeTask = activeId ? tasks.find((t) => t.id === activeId) : null;

  return (
    <DndContext
      id="content-kanban"
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid gap-4 lg:grid-cols-5">
        {TASK_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            tasks={tasks.filter((t) => t.status === status)}
            people={people}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask && <TaskCard task={activeTask} people={people} overlay />}
      </DragOverlay>
    </DndContext>
  );
}
