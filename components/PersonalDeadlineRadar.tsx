"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import Link from "next/link";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import TaskTargetDateEdit from "@/components/TaskTargetDateEdit";
import Icon from "@/components/ui/Icon";
import { setPersonalTaskTargetAction } from "@/lib/actions/tasks";
import {
  CONTENT_TYPE_LABEL,
  TASK_PRIORITY_DOT,
  TASK_PRIORITY_LABEL,
} from "@/lib/constants";
import {
  calendarGridDays,
  formatDateLong,
  formatDateShort,
  formatMonthLabel,
  monthParamToDate,
  shiftISODate,
  shiftMonthParam,
  WEEKDAY_LABELS,
} from "@/lib/date";
import { getActionErrorMessage } from "@/lib/errorMessage";
import { usePanelOpen } from "@/lib/usePanelOpen";
import type { TaskWithPersonalTarget } from "@/lib/types";

// Solda görevler, sağda küçük bir ay takvimi: bir görevi takvimde bir güne
// bırakmak o gün için kişisel hedef koyar. Sürükleyemeyen (klavye/dokunmatik)
// kullanıcı için her satırda ayrıca tarih düğmesi var — sürükle-bırak tek yol
// değil, kısayol.
const PANEL_KEY = "panom-radar";
const DROP_PREFIX = "radar-day:";

const collator = new Intl.Collator("tr");

// dnd-kit'in varsayılanı (`rectIntersection`) SÜRÜKLENEN ÖĞENİN dikdörtgenine
// bakar. Görev satırı listenin tamamı kadar geniş olduğu için aynı anda 3-4
// takvim hücresini kesiyordu ve imleç 14'ün üstündeyken görev 12'ye düşüyordu.
// `pointerWithin` yalnızca imlecin İÇİNDE olduğu hücreyi seçer — takvim gibi
// küçük, bitişik hedeflerde doğru olan bu. Klavyeyle sürüklemede imleç
// koordinatı olmadığı için sonuç boş döner; o durumda merkeze en yakın hedefe
// düşülüyor, yoksa klavye erişimi tamamen kırılırdı.
const dayCollisionDetection: CollisionDetection = (args) => {
  const withinPointer = pointerWithin(args);
  return withinPointer.length > 0 ? withinPointer : closestCenter(args);
};

// Sürüklenen etiket varsayılan olarak "kartı nereden tuttuysan" o noktada
// asılı kalır; hedefi ise (yukarıdaki `pointerWithin`) imleç belirler. İkisi
// ayrı olunca "başka güne bırakıyorum ama başka güne düşüyor" hissi oluşuyor.
// Bu modifier etiketi imlecin ortasına kilitler — görülen şey bırakılan şey.
const snapToCursor: Modifier = ({ activatorEvent, draggingNodeRect, transform }) => {
  if (!draggingNodeRect || !activatorEvent) return transform;
  const { clientX, clientY } = activatorEvent as PointerEvent;
  // Klavyeyle sürüklemede imleç koordinatı yok (KeyboardEvent) — dokunma.
  if (typeof clientX !== "number" || typeof clientY !== "number") return transform;
  return {
    ...transform,
    x: transform.x + clientX - draggingNodeRect.left - draggingNodeRect.width / 2,
    y: transform.y + clientY - draggingNodeRect.top - draggingNodeRect.height / 2,
  };
};

interface RadarRow {
  task: TaskWithPersonalTarget;
  target: string | null;
  // Kişisel hedef ile resmi teslimden hangisi önce geliyorsa "dikkat tarihi"
  // odur — sıralama ve gecikme sayıları buna bakar.
  attention: string | null;
}

function MetricChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "danger" | "warning" | "neutral";
}) {
  const toneClass = {
    danger:
      value > 0
        ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
        : "border-black/10 bg-white text-zinc-500 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-400",
    warning:
      value > 0
        ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
        : "border-black/10 bg-white text-zinc-500 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-400",
    neutral: "border-black/10 bg-white text-zinc-600 dark:border-white/15 dark:bg-zinc-950 dark:text-zinc-300",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${toneClass}`}
    >
      {label}
      <span className="font-semibold tabular-nums">{value}</span>
    </span>
  );
}

function TaskRow({ row, today }: { row: RadarRow; today: string }) {
  const { task, target, attention } = row;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  const overdue = attention !== null && attention < today;
  const isToday = attention === today;

  return (
    <li
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-dragging={isDragging || undefined}
      className={`ui-surface grid cursor-grab touch-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border border-black/[0.06] bg-white px-2.5 py-2 active:cursor-grabbing dark:border-white/[0.08] dark:bg-zinc-950/40 ${
        isDragging ? "opacity-30" : "hover:border-brand-300 dark:hover:border-brand-800"
      }`}
      onPointerDownCapture={(event) => {
        // Satırın içindeki link ve tarih düğmesi sürüklemeyi başlatmasın.
        if ((event.target as HTMLElement).closest("a, button, input, select")) {
          event.stopPropagation();
        }
      }}
    >
      <span
        className={`size-2 shrink-0 rounded-full ${TASK_PRIORITY_DOT[task.priority]}`}
        title={`Öncelik: ${TASK_PRIORITY_LABEL[task.priority]}`}
      />

      <span className="min-w-0">
        <Link
          href={`/tasks/${task.id}`}
          className="block truncate text-sm font-medium text-zinc-800 hover:text-brand-700 dark:text-zinc-200 dark:hover:text-brand-300"
        >
          {task.title}
        </Link>
        <span className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">
          {task.brand_name} · {CONTENT_TYPE_LABEL[task.content_type]}
          {task.due_date && (
            <span
              className={
                overdue && task.due_date <= today
                  ? " font-medium text-rose-600 dark:text-rose-400"
                  : ""
              }
            >
              {" · "}Teslim {formatDateShort(task.due_date)}
            </span>
          )}
        </span>
      </span>

      <span
        className={`shrink-0 ${
          overdue
            ? "rounded-lg bg-rose-50 dark:bg-rose-950/30"
            : isToday
              ? "rounded-lg bg-amber-50 dark:bg-amber-950/30"
              : ""
        }`}
      >
        <TaskTargetDateEdit taskId={task.id} targetDate={target} />
      </span>
    </li>
  );
}

function DayCell({
  date,
  inMonth,
  today,
  targetTitles,
  dueTitles,
}: {
  date: string;
  inMonth: boolean;
  today: string;
  targetTitles: string[];
  dueTitles: string[];
}) {
  // Geçmiş günler bırakma hedefi DEĞİL: sunucu geçmişe hedef yazmayı zaten
  // reddediyor, kullanıcı da boşuna sürüklemesin.
  const isPast = date < today;
  const { setNodeRef, isOver } = useDroppable({ id: `${DROP_PREFIX}${date}`, disabled: isPast });
  const isToday = date === today;

  const hint = [
    formatDateLong(date),
    targetTitles.length > 0 ? `Kişisel hedef: ${targetTitles.join(", ")}` : null,
    dueTitles.length > 0 ? `Resmi teslim: ${dueTitles.join(", ")}` : null,
    isPast ? "Geçmiş güne kişisel hedef verilemez" : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div
      ref={setNodeRef}
      title={hint}
      aria-label={hint}
      className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border text-[11px] transition-colors ${
        isOver
          ? "border-brand-500 bg-brand-100 ring-2 ring-brand-500/30 dark:border-brand-500 dark:bg-brand-900/50"
          : isToday
            ? "border-brand-300 bg-brand-50/70 dark:border-brand-800 dark:bg-brand-950/30"
            : isPast
              ? "border-transparent bg-zinc-50 dark:bg-white/[0.02]"
              : "border-black/[0.06] bg-white hover:border-brand-300 dark:border-white/[0.08] dark:bg-zinc-950/40 dark:hover:border-brand-800"
      }`}
    >
      <span
        className={`tabular-nums ${
          isToday
            ? "font-bold text-brand-700 dark:text-brand-300"
            : inMonth
              ? isPast
                ? "text-zinc-400 dark:text-zinc-600"
                : "font-medium text-zinc-700 dark:text-zinc-200"
              : "text-zinc-400 dark:text-zinc-600"
        }`}
      >
        {Number(date.slice(-2))}
      </span>
      {(targetTitles.length > 0 || dueTitles.length > 0) && (
        <span className="flex items-center gap-0.5">
          {targetTitles.length > 0 && (
            <span className="size-1.5 rounded-full bg-brand-500" aria-hidden="true" />
          )}
          {dueTitles.length > 0 && (
            <span
              className={`size-1.5 rounded-full ${isPast ? "bg-zinc-300 dark:bg-zinc-700" : "bg-rose-500"}`}
              aria-hidden="true"
            />
          )}
        </span>
      )}
    </div>
  );
}

export default function PersonalDeadlineRadar({
  personId,
  tasks,
  today,
  horizonDays,
  headerAction = false,
}: {
  personId: string;
  tasks: TaskWithPersonalTarget[];
  today: string;
  horizonDays: number;
  headerAction?: boolean;
}) {
  // Radar bir kullanici tercihi: ayni tarayicida kimlik degistirildiginde bir
  // kisinin acik/kapali secimi digerinin Panom'unu etkilemesin.
  const { open, toggle } = usePanelOpen(`${PANEL_KEY}:${personId}`, false);
  // Takvim ayı istemci state'i ama başlangıcı SUNUCUDAN gelen `today` —
  // render sırasında `new Date()` çağrılmadığı için SSR/istemci aynı ayı çizer.
  const [monthParam, setMonthParam] = useState(() => today.slice(0, 7));
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const baseTargets = useMemo(
    () =>
      Object.fromEntries(tasks.map((task) => [task.id, task.personal_target_date])) as Record<
        string,
        string | null
      >,
    [tasks],
  );
  // `useOptimistic`: bırakılan kart anında yeni güne geçsin ama sunucu yanıtı
  // gelince tek doğru kaynak yine props olsun. Yerel bir "override" state'i
  // tutsaydık, aynı hedefi başka bir yerden değiştirmek onu bayat bırakırdı.
  const [targets, applyTarget] = useOptimistic(
    baseTargets,
    (state, patch: { taskId: string; date: string | null }) => ({
      ...state,
      [patch.taskId]: patch.date,
    }),
  );

  const rows: RadarRow[] = useMemo(() => {
    const mapped = tasks.map((task) => {
      const target = targets[task.id] ?? null;
      const dates = [task.due_date, target].filter((date): date is string => date !== null).sort();
      return { task, target, attention: dates[0] ?? null };
    });
    // Tarihsizler en sonda; aynı tarihte alfabetik.
    return mapped.sort(
      (a, b) =>
        (a.attention ?? "9999-12-31").localeCompare(b.attention ?? "9999-12-31") ||
        collator.compare(a.task.title, b.task.title),
    );
  }, [tasks, targets]);

  const horizonEnd = shiftISODate(today, horizonDays);
  const overdueCount = rows.filter((row) => row.attention !== null && row.attention < today).length;
  const todayCount = rows.filter((row) => row.attention === today).length;
  const soonCount = rows.filter(
    (row) => row.attention !== null && row.attention > today && row.attention <= horizonEnd,
  ).length;
  const targetCount = rows.filter((row) => row.target !== null).length;
  const nextRow = rows.find((row) => row.attention !== null && row.attention > today);
  const hasImmediateRisk = overdueCount > 0 || todayCount > 0;

  const summary =
    overdueCount > 0
      ? `${overdueCount} işte resmi teslim veya kişisel hedef geçmiş.`
      : todayCount > 0
        ? `Bugün ${todayCount} iş için hedef ya da teslim var.`
        : nextRow
          ? `Sıradaki kritik tarih ${formatDateShort(nextRow.attention)}.`
          : targetCount > 0
            ? `${targetCount} kişisel hedefin planlandı.`
            : `Önümüzdeki ${horizonDays} gün için zaman baskısı görünmüyor.`;

  const marks = useMemo(() => {
    const map = new Map<string, { targets: string[]; dues: string[] }>();
    const at = (date: string) => {
      const existing = map.get(date);
      if (existing) return existing;
      const fresh = { targets: [] as string[], dues: [] as string[] };
      map.set(date, fresh);
      return fresh;
    };
    for (const row of rows) {
      if (row.target) at(row.target).targets.push(row.task.title);
      if (row.task.due_date) at(row.task.due_date).dues.push(row.task.title);
    }
    return map;
  }, [rows]);

  const gridDays = useMemo(() => calendarGridDays(monthParamToDate(monthParam)), [monthParam]);
  const monthLabel = formatMonthLabel(monthParamToDate(monthParam));
  const isCurrentMonth = monthParam === today.slice(0, 7);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    if (!overId.startsWith(DROP_PREFIX)) return;
    const date = overId.slice(DROP_PREFIX.length);
    const taskId = String(active.id);
    if (targets[taskId] === date) return;

    setError(null);
    startTransition(async () => {
      applyTarget({ taskId, date });
      try {
        await setPersonalTaskTargetAction(taskId, date);
      } catch (cause) {
        setError(getActionErrorMessage(cause));
      }
    });
  }

  const activeRow = activeId ? rows.find((row) => row.task.id === activeId) : null;

  const toneBorder =
    overdueCount > 0
      ? "border-rose-200 dark:border-rose-900/70"
      : hasImmediateRisk
        ? "border-amber-200 dark:border-amber-900/70"
        : "border-black/10 dark:border-white/10";
  const toneHeader =
    overdueCount > 0
      ? "bg-rose-50/80 dark:bg-rose-950/20"
      : hasImmediateRisk
        ? "bg-amber-50/80 dark:bg-amber-950/20"
        : "bg-zinc-50/80 dark:bg-white/[0.025]";

  if (!open) {
    const riskCount = overdueCount + todayCount;
    return (
      <div
        className={
          headerAction
            ? "mb-5 flex items-center lg:absolute lg:right-0 lg:top-8 lg:z-10 lg:mb-0"
            : "flex items-center"
        }
      >
        <button
          type="button"
          onClick={toggle}
          aria-label="Kişisel teslim radarını aç"
          aria-expanded="false"
          aria-controls="personal-deadline-body"
          title={summary}
          className={`ui-press inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border bg-surface px-3 text-left shadow-sm hover:bg-surface-hover ${toneBorder}`}
        >
          <Icon
            name="clock"
            className={riskCount > 0 ? "size-4 text-rose-500" : "size-4 text-brand-500"}
          />
          <span className="truncate text-xs font-semibold text-foreground">
            Kişisel teslim radarı
          </span>
          {riskCount > 0 && (
            <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-rose-700 dark:bg-rose-950 dark:text-rose-300">
              {riskCount}
            </span>
          )}
          <span className="text-[11px] font-medium text-brand-600 dark:text-brand-300">Aç</span>
        </button>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="personal-deadline-title"
      className={`mb-7 overflow-hidden rounded-2xl border bg-white shadow-sm dark:bg-zinc-900 ${toneBorder}`}
    >
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:px-4 ${toneHeader}`}>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls="personal-deadline-body"
          className="ui-press flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1 text-left"
        >
          <svg
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
            className={`size-4 shrink-0 text-zinc-500 transition-transform duration-200 dark:text-zinc-400 ${
              open ? "rotate-90" : ""
            }`}
          >
            <path d="M7.21 14.77a.75.75 0 0 1 0-1.06L10.94 10 7.21 6.29a.75.75 0 1 1 1.06-1.06l4.25 4.24a.75.75 0 0 1 0 1.06l-4.25 4.24a.75.75 0 0 1-1.06 0Z" />
          </svg>
          <span className="min-w-0">
            <span
              id="personal-deadline-title"
              className="block font-semibold text-zinc-900 dark:text-zinc-100"
            >
              Kişisel teslim radarı
            </span>
            <span className="block truncate text-xs text-zinc-600 dark:text-zinc-300">
              {summary}
            </span>
          </span>
        </button>

        {/* Sayaçlar kart KAPALIYKEN de görünür: radarın tek satırlık hâli bile
            "acil bir şey var mı" sorusunu cevaplamalı. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <MetricChip label="Geciken" value={overdueCount} tone="danger" />
          <MetricChip label="Bugün" value={todayCount} tone="warning" />
          <MetricChip label={`${horizonDays} gün`} value={soonCount} tone="neutral" />
          <Link
            href={`/tasks?assignee=${encodeURIComponent(personId)}`}
            className="ui-press inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950/40"
          >
            Tüm görevlerim →
          </Link>
        </div>
      </div>

      {open && (
        <div id="personal-deadline-body" className="ui-enter">
          <DndContext
            id="panom-radar"
            sensors={sensors}
            collisionDetection={dayCollisionDetection}
            onDragStart={(event: DragStartEvent) => setActiveId(String(event.active.id))}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <div className="grid min-w-0 gap-3 p-3 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-4 lg:p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Öncelik sırası
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Bir görevi takvimde bir güne bırak → o gün kişisel hedefin olur
                  </p>
                </div>

                {error && (
                  <p
                    role="alert"
                    className="mb-2 rounded-lg bg-rose-50 px-2 py-1.5 text-xs font-medium text-rose-600 dark:bg-rose-950/30 dark:text-rose-400"
                  >
                    {error}
                  </p>
                )}

                {rows.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-black/10 px-3 py-6 text-center text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                    Sana atanmış açık görev yok. 🎉
                  </p>
                ) : (
                  <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-0.5">
                    {rows.map((row) => (
                      <TaskRow key={row.task.id} row={row} today={today} />
                    ))}
                  </ul>
                )}
              </div>

              <div className="min-w-0 rounded-xl border border-black/[0.07] bg-zinc-50/70 p-2.5 dark:border-white/[0.08] dark:bg-white/[0.02]">
                <div className="flex items-center justify-between gap-1 pb-1.5">
                  <button
                    type="button"
                    onClick={() => setMonthParam((month) => shiftMonthParam(month, -1))}
                    aria-label="Önceki ay"
                    className="ui-press inline-flex size-8 items-center justify-center rounded-lg text-lg leading-none text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
                  >
                    ‹
                  </button>
                  <span className="text-xs font-semibold">{monthLabel}</span>
                  <div className="flex items-center">
                    {!isCurrentMonth && (
                      <button
                        type="button"
                        onClick={() => setMonthParam(today.slice(0, 7))}
                        className="ui-press inline-flex min-h-8 items-center rounded-lg px-2 text-[11px] font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-950/30"
                      >
                        Bugün
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setMonthParam((month) => shiftMonthParam(month, 1))}
                      aria-label="Sonraki ay"
                      className="ui-press inline-flex size-8 items-center justify-center rounded-lg text-lg leading-none text-zinc-600 hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
                    >
                      ›
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAY_LABELS.map((label, index) => (
                    <div
                      key={`${label}-${index}`}
                      className="pb-0.5 text-center text-[10px] font-semibold uppercase text-zinc-500 dark:text-zinc-400"
                    >
                      {label.slice(0, 2)}
                    </div>
                  ))}
                  {gridDays.map((day) => {
                    const dayMarks = marks.get(day.date);
                    return (
                      <DayCell
                        key={day.date}
                        date={day.date}
                        inMonth={day.inMonth}
                        today={today}
                        targetTitles={dayMarks?.targets ?? []}
                        dueTitles={dayMarks?.dues ?? []}
                      />
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-[10px] text-zinc-500 dark:text-zinc-400">
                  <span className="inline-flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-brand-500" aria-hidden="true" />
                    Kişisel hedef
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-rose-500" aria-hidden="true" />
                    Resmi teslim
                  </span>
                </div>
              </div>
            </div>

            <DragOverlay modifiers={[snapToCursor]} dropAnimation={null}>
              {activeRow && (
                <div className="flex items-center gap-1.5 rotate-[1deg] rounded-xl border border-brand-400 bg-surface px-3 py-2 text-xs font-medium shadow-xl">
                  <Icon name="clock" className="size-3.5" /> {activeRow.task.title}
                </div>
              )}
            </DragOverlay>
          </DndContext>

          <p className="border-t border-black/[0.07] px-3 py-2 text-[11px] text-zinc-500 sm:px-4 dark:border-white/[0.08] dark:text-zinc-400">
            Kişisel hedef yalnızca sana görünür; resmi teslim tarihini değiştirmez veya gizlemez.
          </p>
        </div>
      )}
    </section>
  );
}
