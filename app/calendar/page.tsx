import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import CalendarGrid from "@/components/CalendarGrid";
import QuickAddModal from "@/components/QuickAddModal";
import TaskListView from "@/components/TaskListView";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import { requirePageSession } from "@/lib/identity";
import { listBrands } from "@/lib/repositories/brands";
import { listAllContentSummaries } from "@/lib/repositories/content";
import {
  calendarGridDays,
  formatDateLong,
  formatMonthLabel,
  monthParamISO,
  monthParamToDate,
  shiftMonthParam,
  todayISO,
} from "@/lib/date";
import { listActivePeople } from "@/lib/repositories/people";
import { listTasksDueInRange } from "@/lib/repositories/tasks";
import type { TaskWithContext } from "@/lib/types";

export const dynamic = "force-dynamic";

const DAY_PARAM_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string; yeni?: string }>;
}) {
  const me = await requirePageSession();
  const sp = await searchParams;
  const monthDate = monthParamToDate(sp.month);
  const monthParam = monthParamISO(monthDate);
  const selectedDay = sp.day && DAY_PARAM_RE.test(sp.day) ? sp.day : null;
  // Izgaradaki "+" kısayolu buraya gelir: gün detayı açılırken hızlı görev
  // formu da o tarihle birlikte açılsın.
  const wantsNewTask = selectedDay !== null && sp.yeni === "1";

  // Aralık, görüntülenen AYIN değil IZGARANIN sınırlarına göre çekiliyor:
  // ızgara başta/sonda bir önceki/sonraki aydan dolgu günleri gösteriyor
  // (bkz. CalendarGrid) ve o hücrelerde de gerçek görevler görünsün istiyoruz
  // — yoksa "soluk" günler her zaman boş görünür, oysa komşu ayda iş olabilir.
  const gridDays = calendarGridDays(monthDate);
  const rangeStart = gridDays[0].date;
  const rangeEnd = gridDays[gridDays.length - 1].date;
  const tasks = listTasksDueInRange(rangeStart, rangeEnd);
  const people = listActivePeople();
  const today = todayISO();
  // Gün panelindeki hızlı görev formu için (marka → içerik → görev), header'daki
  // "+ Yeni" ile aynı bileşen.
  const brands = listBrands();
  const contents = listAllContentSummaries();

  const tasksByDate = new Map<string, TaskWithContext[]>();
  for (const t of tasks) {
    if (!t.due_date) continue;
    const list = tasksByDate.get(t.due_date);
    if (list) list.push(t);
    else tasksByDate.set(t.due_date, [t]);
  }

  // Boş ay kontrolü ızgaranın dolgu günlerini SAYMAZ: bir önceki/sonraki aydan
  // taşan 1-6 gün dolu olsa bile "bu ay boş" mesajı görüntülenen ay için doğru
  // kalmalı.
  const hasTasksThisMonth = tasks.some((t) => t.due_date?.startsWith(monthParam));

  const prevMonthParam = shiftMonthParam(monthParam, -1);
  const nextMonthParam = shiftMonthParam(monthParam, 1);
  const isCurrentMonth = monthParam === monthParamISO(new Date());

  const dayTasks = selectedDay ? (tasksByDate.get(selectedDay) ?? []) : [];

  return (
    <div>
      <AutoRefresh />
      <PageHeader
        eyebrow="PLANLAMA"
        title="Takvim"
        description="Teslim tarihlerini aylık görünümde izle ve gün bazında planla."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!isCurrentMonth && (
              <Link
                href="/calendar"
                className="ui-press inline-flex min-h-10 items-center rounded-[10px] px-3 text-sm font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950"
              >
                Bugün
              </Link>
            )}
            <nav aria-label="Aylar arasında gezin" className="flex items-center rounded-[10px] border border-border-default bg-surface p-0.5">
              <Link
                href={`/calendar?month=${prevMonthParam}`}
                aria-label="Önceki ay"
                className="ui-press grid size-9 place-items-center rounded-lg text-secondary hover:bg-surface-hover"
              >
                <Icon name="chevron-left" className="size-4" />
              </Link>
              <h2 className="min-w-[12ch] px-2 text-center text-sm font-semibold text-foreground">
                {formatMonthLabel(monthDate)}
              </h2>
              <Link
                href={`/calendar?month=${nextMonthParam}`}
                aria-label="Sonraki ay"
                className="ui-press grid size-9 place-items-center rounded-lg text-secondary hover:bg-surface-hover"
              >
                <Icon name="chevron-right" className="size-4" />
              </Link>
            </nav>
          </div>
        }
      />

      <div className="space-y-3">
      {!hasTasksThisMonth && (
        <div className="rounded-xl border border-border-default bg-surface p-6 text-center">
          <p className="text-sm font-medium text-foreground">
            Bu ayda teslim tarihi olan görev yok.
          </p>
          <p className="mt-1 text-xs text-muted">
            Başka bir aya bakabilir ya da{" "}
            <Link href="/tasks" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              Görevler
            </Link>{" "}
            sayfasından bir göreve tarih atayabilirsin.
          </p>
        </div>
      )}

      <CalendarGrid
        gridDays={gridDays}
        tasksByDate={tasksByDate}
        today={today}
        monthParam={monthParam}
        selectedDay={selectedDay}
      />

      {selectedDay && (
        <section className="ui-enter space-y-3 rounded-xl border border-border-default bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              {formatDateLong(selectedDay)}{" "}
              <span className="font-normal text-muted">
                · {dayTasks.length > 0 ? `${dayTasks.length} görev` : "görev yok"}
              </span>
            </h2>
            <div className="flex items-center gap-2">
              {/* `key`: gün ya da "yeni" isteği değişince modal yeniden
                  kurulsun — `initialOpen` yalnızca ilk render'da okunur. */}
              <QuickAddModal
                key={`${selectedDay}-${wantsNewTask}`}
                brands={brands}
                contents={contents}
                people={people}
                defaultAssigneeId={me?.id ?? null}
                defaultDueDate={selectedDay}
                initialOpen={wantsNewTask}
                triggerLabel="Bu güne görev ekle"
                triggerClassName="ui-press inline-flex min-h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-[10px] bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-500"
              />
              <Link
                href={`/calendar?month=${monthParam}`}
                className="ui-press inline-flex min-h-10 items-center rounded-[10px] px-3 text-xs font-medium text-muted hover:bg-surface-hover hover:text-foreground"
              >
                Kapat ×
              </Link>
            </div>
          </div>
          {dayTasks.length > 0 ? (
            <TaskListView tasks={dayTasks} people={people} />
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Bu günde teslim tarihi olan görev yok.
            </p>
          )}
        </section>
      )}
      </div>
    </div>
  );
}
