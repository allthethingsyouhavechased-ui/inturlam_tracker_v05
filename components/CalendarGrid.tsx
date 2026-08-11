import Link from "next/link";
import { TASK_PRIORITY_BADGE, TASK_PRIORITY_DOT } from "@/lib/constants";
import { formatDateLong, WEEKDAY_LABELS, type CalendarGridDay } from "@/lib/date";
import type { TaskWithContext } from "@/lib/types";

// Mobilde hücre başına gösterilecek nokta sayısı. Masaüstünde hücre kendi
// içinde kayar; böylece tüm ay tek ekrana sığarken yoğun günlerin verisi kaybolmaz.
const MAX_DOTS = 6;

function cellToneClass(inMonth: boolean, isSelected: boolean): string {
  if (isSelected) {
    return "border-brand-400 bg-brand-50/70 ring-1 ring-inset ring-brand-400 dark:border-brand-700 dark:bg-brand-950/30 dark:ring-brand-700";
  }
  if (!inMonth) {
    return "border-black/5 bg-zinc-50/70 dark:border-white/5 dark:bg-white/[0.03]";
  }
  return "border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900";
}

function dateNumberClass(isToday: boolean, inMonth: boolean): string {
  if (isToday) return "bg-brand-600 text-white";
  if (inMonth) {
    return "text-zinc-900 hover:text-brand-600 dark:text-zinc-100 dark:hover:text-brand-400";
  }
  // Dolgu günleri: iki temada da ≥4.5:1 kalan soluk-metin çifti (bkz. CLAUDE.md
  // "Tasarım kuralları") — ayın dışında olduğunu gösterir ama okunaksız olmaz.
  return "text-zinc-500 hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-400";
}

// Ay ızgarasının 7 sütunlu grid'i: haftanın günleri başlığı + her gün için bir
// hücre. Mobilde görevler yalnızca nokta olduğu için hücrenin tamamı gün detayına
// gider; sm+ ekranda yalnızca üst şerit gün linkidir ve görev pill'leri kendi
// görevlerine gider. Böylece linkler iç içe geçmeden hedefler rahat tıklanır.
export default function CalendarGrid({
  gridDays,
  tasksByDate,
  today,
  monthParam,
  selectedDay,
}: {
  gridDays: CalendarGridDay[];
  tasksByDate: Map<string, TaskWithContext[]>;
  today: string;
  monthParam: string;
  selectedDay: string | null;
}) {
  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-2 lg:h-[calc(100dvh-14.5rem)] lg:min-h-[31rem] lg:grid-rows-[auto_repeat(6,minmax(0,1fr))]">
      {WEEKDAY_LABELS.map((label, i) => (
        <div
          key={`${label}-${i}`}
          className="px-1 pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
        >
          {label}
        </div>
      ))}

      {gridDays.map((day) => {
        const dayTasks = tasksByDate.get(day.date) ?? [];
        const isToday = day.date === today;
        const isSelected = day.date === selectedDay;
        const dayHref = `/calendar?month=${monthParam}&day=${day.date}`;
        // `yeni=1`: gün detayını açar VE hızlı görev formunu bu tarihle
        // doğrudan başlatır (bkz. app/calendar/page.tsx).
        const newTaskHref = `${dayHref}&yeni=1`;
        const dayNumber = Number(day.date.slice(-2));
        const dayLabel = formatDateLong(day.date);

        return (
          <div
            key={day.date}
            className={`ui-surface group relative flex min-h-20 min-w-0 flex-col gap-0.5 overflow-hidden rounded-xl border p-1 sm:min-h-[92px] sm:p-1.5 lg:min-h-0 ${cellToneClass(day.inMonth, isSelected)} ${
              isSelected ? "shadow-md" : "hover:border-brand-300 hover:shadow-md dark:hover:border-brand-800"
            }`}
          >
            <Link
              href={dayHref}
              aria-current={isToday ? "date" : undefined}
              aria-label={dayTasks.length > 0 ? `${dayLabel} — ${dayTasks.length} görev` : dayLabel}
              className="ui-press absolute inset-0 z-0 inline-flex w-full shrink-0 items-start justify-start rounded-xl p-1 text-xs font-semibold hover:bg-black/[0.035] sm:static sm:min-h-8 sm:items-center sm:rounded-lg sm:px-1 sm:py-0 dark:hover:bg-white/[0.06]"
            >
              <span
                className={`grid size-8 place-items-center rounded-full ${dateNumberClass(isToday, day.inMonth)}`}
              >
                {dayNumber}
              </span>
            </Link>

            {/* Hücrenin sağ üstünde, üzerine gelince beliren "bu güne görev
                ekle" kısayolu. Tarih numarasının linkiyle KARDEŞ (iç içe <a>
                geçersiz olurdu). Mobilde gizli: orada hücrenin tamamı gün
                detayına gidiyor, ekleme düğmesi o panelde. */}
            <Link
              href={newTaskHref}
              aria-label={`${dayLabel} için görev ekle`}
              title="Bu güne görev ekle"
              className="ui-press absolute right-1 top-1 z-10 hidden size-6 items-center justify-center rounded-lg text-sm font-semibold text-zinc-400 opacity-0 transition-opacity hover:bg-brand-50 hover:text-brand-700 focus-visible:opacity-100 group-hover:opacity-100 sm:inline-flex dark:text-zinc-500 dark:hover:bg-brand-950 dark:hover:text-brand-300"
            >
              +
            </Link>

            {/* sm+: öncelik renkli, başlığı okunabilir pill'ler */}
            <div className="hidden min-h-0 min-w-0 flex-col gap-0.5 overflow-y-auto overscroll-contain sm:flex">
              {dayTasks.map((t) => (
                <Link
                  key={t.id}
                  href={`/tasks/${t.id}`}
                  title={t.title}
                  className={`ui-press flex min-h-5 items-center truncate rounded-md px-2 py-0.5 text-[10px] font-medium leading-tight hover:translate-x-0.5 ${TASK_PRIORITY_BADGE[t.priority]}`}
                >
                  {t.title}
                </Link>
              ))}
            </div>

            {/* Mobil: pill metni bir 7 sütunlu hücreye sığmıyor, yalnızca
                öncelik renginde noktalar — sayı/başlık için tarihe dokun. */}
            {dayTasks.length > 0 && (
              <div className="pointer-events-none relative z-10 mt-10 flex flex-wrap gap-0.5 sm:hidden" aria-hidden>
                {dayTasks.slice(0, MAX_DOTS).map((t) => (
                  <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${TASK_PRIORITY_DOT[t.priority]}`} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
