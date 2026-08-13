import Link from "next/link";
import { calendarEventTone } from "@/lib/calendar/colors";
import { calendarWeekEventSegments } from "@/lib/calendar/layout";
import { todayISO, WEEKDAY_LABELS, type CalendarGridDay } from "@/lib/date";
import type { CalendarEvent } from "@/lib/types";

function eventTime(event: CalendarEvent): string {
  if (event.all_day === 1) return "";
  return `${new Date(event.start_at).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  })} · `;
}

function weeksOf(gridDays: CalendarGridDay[]): CalendarGridDay[][] {
  return Array.from({ length: Math.ceil(gridDays.length / 7) }, (_, index) =>
    gridDays.slice(index * 7, index * 7 + 7),
  );
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
  const today = todayISO();

  return (
    <div className="min-w-0">
      <p className="mb-2 text-[11px] text-muted sm:hidden">Takvimin devamını görmek için yatay kaydır.</p>
      <div
        role="region"
        aria-label="Aylık etkinlik takvimi"
        tabIndex={0}
        className="-mx-1 overflow-x-auto px-1 pb-2 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:mx-0 sm:overflow-visible sm:px-0"
      >
        <div className="min-w-[44rem] sm:min-w-0">
          <div className="mb-1 grid grid-cols-7 gap-x-1 sm:gap-x-2">
            {WEEKDAY_LABELS.map((day) => (
              <div key={day} className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
                {day}
              </div>
            ))}
          </div>
          <div className="space-y-1 sm:space-y-2">
            {weeksOf(gridDays).map((week) => {
          const segments = calendarWeekEventSegments(events, week);
          const laneCount = segments.reduce((count, segment) => Math.max(count, segment.lane + 1), 0);
          const spacerRow = laneCount + 2;
          const gridTemplateRows = laneCount > 0
            ? `1.75rem repeat(${laneCount}, 1.5rem) minmax(4rem, auto)`
            : "1.75rem minmax(4rem, auto)";

          return (
            <div
              key={week[0].date}
              className="relative grid grid-cols-7 gap-x-1 gap-y-1 sm:gap-x-2"
              style={{ gridTemplateRows }}
            >
              {week.map((day, dayIndex) => {
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
                    style={{ gridColumn: dayIndex + 1, gridRow: `1 / ${spacerRow + 1}` }}
                    className={`relative overflow-hidden rounded-xl border transition-colors ${
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
                  </div>
                );
              })}

              {week.map((day, dayIndex) => {
                const isToday = day.date === today;
                const isSelected = day.date === selectedDate;
                return (
                  <div
                    key={`label-${day.date}`}
                    style={{ gridColumn: dayIndex + 1, gridRow: 1 }}
                    className={`pointer-events-none relative z-10 px-1.5 pt-1.5 text-xs font-semibold ${isToday || isSelected ? "text-brand-600 dark:text-brand-300" : "text-secondary"}`}
                  >
                    {Number(day.date.slice(-2))}
                  </div>
                );
              })}

              {segments.map((segment) => {
                const segmentDate = week[segment.startColumn - 1].date;
                const eventQuery = new URLSearchParams(preservedQuery);
                eventQuery.set("month", segmentDate.slice(0, 7));
                eventQuery.set("day", segmentDate);
                eventQuery.set("event", segment.event.id);
                const className = `pointer-events-auto relative z-20 block min-w-0 truncate px-1.5 py-1 text-[10px] font-semibold leading-4 ${calendarEventTone(segment.event)} ${segment.continuesBefore ? "rounded-l-none" : "rounded-l-md"} ${segment.continuesAfter ? "rounded-r-none" : "rounded-r-md"}`;
                const content = <>{segment.showTime ? eventTime(segment.event) : ""}{segment.event.title}</>;
                const style = {
                  gridColumn: `${segment.startColumn} / span ${segment.span}`,
                  gridRow: segment.lane + 2,
                };

                return editable ? (
                  <Link key={`${segment.event.id}-${week[0].date}`} href={`${basePath}?${eventQuery}`} className={className} style={style} title={segment.event.title}>
                    {content}
                  </Link>
                ) : (
                  <div key={`${segment.event.id}-${week[0].date}`} className={className} style={style} title={segment.event.title}>
                    {content}
                  </div>
                );
              })}

              <div
                aria-hidden="true"
                className="pointer-events-none col-span-7 min-h-12 sm:min-h-20"
                style={{ gridRow: spacerRow }}
              />
            </div>
          );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
