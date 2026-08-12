import Link from "next/link";
import { todayISO, WEEKDAY_LABELS, type CalendarGridDay } from "@/lib/date";
import type { CalendarEvent } from "@/lib/types";

const TYPE_TONE = {
  Toplanti: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  Cekim: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  Diger: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
} as const;

function eventTime(event: CalendarEvent): string {
  if (event.all_day === 1) return "";
  return `${new Date(event.start_at).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  })} · `;
}

export default function EventCalendarGrid({
  gridDays,
  events,
  basePath = "/calendar",
  editable = true,
  preservedQuery = "",
  selectedDate = null,
}: {
  gridDays: CalendarGridDay[];
  events: CalendarEvent[];
  basePath?: string;
  editable?: boolean;
  preservedQuery?: string;
  selectedDate?: string | null;
}) {
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const date = event.start_at.slice(0, 10);
    byDay.set(date, [...(byDay.get(date) ?? []), event]);
  }
  const today = todayISO();

  return (
    <div className="grid grid-cols-7 gap-1 sm:gap-2">
      {WEEKDAY_LABELS.map((day) => (
        <div key={day} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
          {day}
        </div>
      ))}
      {gridDays.map((day) => {
        const dayEvents = byDay.get(day.date) ?? [];
        const isToday = day.date === today;
        const isSelected = day.date === selectedDate;
        const dayQuery = new URLSearchParams(preservedQuery);
        dayQuery.set("month", day.date.slice(0, 7));
        dayQuery.set("day", day.date);

        return (
          <div
            key={day.date}
            aria-current={isToday ? "date" : undefined}
            data-selected={isSelected || undefined}
            className={`relative min-h-24 overflow-hidden rounded-xl border p-1.5 transition-colors sm:min-h-32 ${
              isSelected
                ? "border-brand-500 bg-brand-50/50 ring-1 ring-brand-500/20 dark:bg-brand-950/20"
                : isToday
                  ? "border-brand-400 bg-surface ring-1 ring-brand-500/15"
                  : day.inMonth
                    ? "border-border-default bg-surface hover:border-border-strong hover:bg-surface-hover"
                    : "border-border-default bg-surface-subtle opacity-70 hover:opacity-100"
            }`}
          >
            {editable && (
              <Link
                href={`${basePath}?${dayQuery}`}
                aria-label={`${day.date} günü için etkinlik oluştur`}
                className="absolute inset-0 z-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
              >
                <span className="sr-only">{day.date} gününü seç</span>
              </Link>
            )}
            <div className={`pointer-events-none relative z-10 mb-1 text-xs font-semibold ${isToday || isSelected ? "text-brand-600 dark:text-brand-300" : "text-secondary"}`}>
              {Number(day.date.slice(-2))}
            </div>
            <div className="pointer-events-none relative z-10 space-y-1">
              {dayEvents.slice(0, 4).map((event) => {
                if (!editable) {
                  return (
                    <div key={event.id} className={`truncate rounded-md px-1.5 py-1 text-[10px] font-semibold ${TYPE_TONE[event.type]}`}>
                      {eventTime(event)}{event.title}
                    </div>
                  );
                }
                const eventQuery = new URLSearchParams(preservedQuery);
                eventQuery.set("month", event.start_at.slice(0, 7));
                eventQuery.set("day", event.start_at.slice(0, 10));
                eventQuery.set("event", event.id);
                return (
                  <Link
                    key={event.id}
                    href={`${basePath}?${eventQuery}`}
                    className={`pointer-events-auto block truncate rounded-md px-1.5 py-1 text-[10px] font-semibold ${TYPE_TONE[event.type]}`}
                  >
                    {eventTime(event)}{event.title}
                  </Link>
                );
              })}
              {dayEvents.length > 4 && <p className="px-1 text-[10px] text-muted">+{dayEvents.length - 4} etkinlik</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
