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
import { useMemo, useState, useTransition } from "react";
import TaskCommentsPanel from "@/components/TaskCommentsPanel";
import TaskContextMenu, { useTaskContextMenu } from "@/components/TaskContextMenu";
import TaskGridCard from "@/components/TaskGridCard";
import { setTaskStatusAction } from "@/lib/actions/tasks";
import { TASK_DRAG_INSTRUCTIONS, taskDragAnnouncements } from "@/lib/dndAnnouncements";
import {
  TASK_PRIORITY_LABEL,
  TASK_STATUS_BADGE,
  TASK_STATUS_BORDER_TOP,
  TASK_STATUS_DOT,
  TASK_STATUS_LABEL,
  TASK_STATUSES,
} from "@/lib/constants";
import type { TaskSortKey } from "@/lib/taskFilterParams";
import type { Person, TaskStatus, TaskWithContext } from "@/lib/types";

// Tek tanım `lib/taskFilterParams.ts`te: URL doğrulaması ile pano sıralaması
// aynı listeyi paylaşmalı, yoksa adres çubuğundan gelen bir `sort` değeri
// sessizce yok sayılır.
export type SortKey = TaskSortKey;

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "varsayilan", label: "Varsayılan" },
  { key: "marka", label: "Marka" },
  { key: "oncelik", label: "Öncelik" },
  { key: "atanan", label: "Atanan" },
];

const collator = new Intl.Collator("tr");

// Hangi sıralama düğmesine tıklanırsa, kartlar o alanın değerine göre
// alfabetik sıralanır — durum sütunlarının kendisi hep sabit kalır, sadece
// bir sütunun İÇİNDEKİ kart sırası değişir.
function sortTasks(tasks: TaskWithContext[], key: SortKey): TaskWithContext[] {
  // "durum"a göre sıralamanın bir sütun içinde görünür etkisi yok (o sütundaki
  // her kart zaten aynı duruma sahip) — yine de tip bütünlüğü için ele alınıyor.
  if (key === "varsayilan" || key === "durum") return tasks;
  const valueOf = (t: TaskWithContext): string => {
    if (key === "marka") return t.brand_name;
    if (key === "oncelik") return TASK_PRIORITY_LABEL[t.priority];
    return t.assignee_name ?? "￿"; // atanmamışlar en sona
  };
  return [...tasks].sort((a, b) => collator.compare(valueOf(a), valueOf(b)));
}

function DraggableCard({
  task,
  onOpenComments,
  onContextMenu,
}: {
  task: TaskWithContext;
  onOpenComments?: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-dnd-card
      data-dragging={isDragging || undefined}
      className={`ui-surface touch-none cursor-grab rounded-xl active:cursor-grabbing ${
        isDragging ? "scale-[0.98] opacity-25" : ""
      }`}
      onPointerDownCapture={(e) => {
        // Kartın içindeki etkileşimli öğeler (başlık linki, kişisel hedef
        // düğmesi, tarih seçici) sürüklemeyi tetiklemesin — yoksa tarihe
        // tıklamak kartı sürüklemeye başlıyor.
        if ((e.target as HTMLElement).closest("a, button, select, input")) {
          e.stopPropagation();
        }
      }}
    >
      <TaskGridCard
        task={task}
        showStatus={false}
        badges={task.badges}
        onOpenComments={onOpenComments}
        onContextMenu={onContextMenu}
      />
    </div>
  );
}

function Column({
  status,
  tasks,
  onOpenComments,
  onContextMenu,
}: {
  status: TaskStatus;
  tasks: TaskWithContext[];
  onOpenComments: (task: TaskWithContext) => void;
  onContextMenu: (event: React.MouseEvent, task: TaskWithContext) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      data-drop-column={status}
      data-drop-active={isOver || undefined}
      className={`min-h-40 min-w-0 space-y-2 rounded-xl border border-border-default border-t-2 bg-surface-subtle p-3 transition-[background-color,border-color,box-shadow,transform] duration-200 ${TASK_STATUS_BORDER_TOP[status]} ${
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
        {tasks.map((t) => (
          <DraggableCard
            key={t.id}
            task={t}
            onOpenComments={() => onOpenComments(t)}
            onContextMenu={(event) => onContextMenu(event, t)}
          />
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

// 5 durum sütunlu, sürükle-bırak destekli, sıralanabilir görev board'u.
// Görevler sayfası ve Panom'un her bölümü bu component'i paylaşır.
//
// `sortKey` dışarıdan verilirse (Görevler'de filtre kutularının kendisi bu
// görevi görür) board kendi "Sırala:" düğmelerini göstermez — kontrol tamamen
// dışarıdadır. Verilmezse (Panom'da olduğu gibi, filtre kutuları yok) board
// kendi dahili düğmelerini gösterir.
//
// `boardId`: dnd-kit DndContext, erişilebilirlik açıklaması için otomatik
// artan bir sayaçla id üretir; bir sayfada (Panom'da olduğu gibi) birden
// fazla DndContext varsa sunucu ile istemcinin ulaştığı sayı farklı olabilir
// ve React hydration uyarısı verir. dnd-kit'in kendi önerisi: her instance'a
// sabit, benzersiz bir `id` vermek (bkz. dnd-kit SSR dokümantasyonu).
export default function TaskBoard({
  tasks,
  people = [],
  canDeleteTasks = false,
  sortKey: externalSortKey,
  boardId,
  toolbar,
}: {
  tasks: TaskWithContext[];
  /** Yorum panelindeki @etiket vurgusu için. */
  people?: Person[];
  canDeleteTasks?: boolean;
  sortKey?: SortKey;
  boardId: string;
  // "Sırala:" satırının sağ ucuna yerleşen ek denetim (Panom'da Pano/Liste
  // düğmesi). Board kendi sıralama düğmelerini göstermediğinde (kontrollü mod)
  // satır yalnızca bunun için çizilir.
  toolbar?: React.ReactNode;
}) {
  const [taskList, setTaskList] = useState(tasks);
  const [prevTasks, setPrevTasks] = useState(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [internalSortKey, setInternalSortKey] = useState<SortKey>("varsayilan");
  const [openComments, setOpenComments] = useState<{ id: string; title: string } | null>(null);
  const contextMenu = useTaskContextMenu();
  const [statusError, setStatusError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isControlled = externalSortKey !== undefined;
  const sortKey = isControlled ? externalSortKey : internalSortKey;

  if (tasks !== prevTasks) {
    setPrevTasks(tasks);
    setTaskList(tasks);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const announcements = useMemo(
    () =>
      taskDragAnnouncements({
        taskName: (id) => taskList.find((task) => task.id === id)?.title ?? "",
        columnLabel: (id) => TASK_STATUS_LABEL[id as TaskStatus] ?? id,
      }),
    [taskList],
  );

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || pending) return;
    const newStatus = over.id as TaskStatus;
    const taskId = active.id as string;
    const task = taskList.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    setTaskList((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)),
    );
    setStatusError(null);
    startTransition(async () => {
      try {
        const result = await setTaskStatusAction(taskId, newStatus);
        if (!result.ok) throw new Error(result.error);
      } catch (error) {
        setTaskList((prev) => prev.map((t) => t.id === taskId ? { ...t, status: task.status } : t));
        setStatusError(error instanceof Error ? error.message : "Durum güncellenemedi. Yeniden deneyin.");
      }
    });
  }

  const activeTask = activeId ? taskList.find((t) => t.id === activeId) : null;

  return (
    <div className="space-y-2">
      {statusError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{statusError}</p>}
      {(!isControlled || toolbar) && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {!isControlled && (
            <>
              <span className="text-zinc-500 dark:text-zinc-400">Sırala:</span>
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setInternalSortKey(opt.key)}
                  className={`ui-press min-h-11 rounded-full px-3 py-2 font-medium ${
                    sortKey === opt.key
                      ? "bg-brand-600 text-white"
                      : "bg-black/5 text-zinc-600 hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/20"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </>
          )}
          {toolbar && <div className="ml-auto">{toolbar}</div>}
        </div>
      )}
      <DndContext
        id={boardId}
        sensors={sensors}
        accessibility={{ announcements, screenReaderInstructions: TASK_DRAG_INSTRUCTIONS }}
        onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        <div tabIndex={0} role="region" aria-label="Görev panosu, durum sütunları yatay kaydırılabilir" className="grid min-w-0 max-w-full grid-flow-col auto-cols-[minmax(15rem,1fr)] gap-3 overflow-x-auto pb-3 focus-visible:outline-2 focus-visible:outline-brand-500">
          {TASK_STATUSES.map((s) => (
            <Column
              key={s}
              status={s}
              tasks={sortTasks(
                taskList.filter((t) => t.status === s),
                sortKey,
              )}
              onOpenComments={(task) => setOpenComments({ id: task.id, title: task.title })}
              onContextMenu={(event, task) => contextMenu.open(event, {
                id: task.id,
                title: task.title,
                archived: task.archived_at !== null,
                status: task.status,
              })}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask && (
            <div className="rotate-[1deg] scale-[1.02] cursor-grabbing shadow-2xl">
              <TaskGridCard task={activeTask} showStatus={false} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Yorumlar göreve girmeden yan panelde okunuyor — liste görünümündeki
          davranışın aynısı, aynı bileşen. */}
      {openComments && (
        <TaskCommentsPanel
          taskId={openComments.id}
          taskTitle={openComments.title}
          people={people}
          onClose={() => setOpenComments(null)}
        />
      )}

      {contextMenu.state && (
        <TaskContextMenu
          target={contextMenu.state.target}
          position={contextMenu.state.position}
          canDelete={canDeleteTasks}
          onClose={contextMenu.close}
        />
      )}
    </div>
  );
}
