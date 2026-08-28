import Link from "next/link";
import { brandAccentStyle } from "@/lib/brandAccent";
import { calendarEventTone } from "@/lib/calendar/colors";
import { calendarWeekEventSegments } from "@/lib/calendar/layout";
import { todayISO, WEEKDAY_LABELS, type CalendarGridDay } from "@/lib/date";
import type { CalendarEvent } from "@/lib/types";

function eventTime(event: CalendarEvent): string {
  if (event.all_day === 1) return "";
  return new Date(event.start_at).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
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
    <div
      role="region"
      aria-label="Aylık etkinlik takvimi; dar ekranlarda yatay kaydırılabilir"
      tabIndex={0}
      className="min-w-0 overflow-x-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
    >
      <div className="min-w-[50rem]">
        <div className="grid grid-cols-7 border-b border-border-default bg-surface-subtle">
          {WEEKDAY_LABELS.map((day, index) => (
            <div
              key={day}
              className={`border-r border-border-subtle px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] last:border-r-0 ${index > 4 ? "text-faint" : "text-muted"}`}
            >
              {day}
            </div>
          ))}
        </div>

        <div>
          {weeksOf(gridDays).map((week) => {
            const segments = calendarWeekEventSegments(events, week);
            const laneCount = segments.reduce((count, segment) => Math.max(count, segment.lane + 1), 0);
            const spacerRow = laneCount + 2;
            const gridTemplateRows = laneCount > 0
              ? `2.25rem repeat(${laneCount}, 1.65rem) minmax(3.5rem, auto)`
              : "2.25rem minmax(3.5rem, auto)";

            return (
              <div
                key={week[0].date}
                className="relative grid grid-cols-7 border-b border-border-subtle last:border-b-0"
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
                      data-calendar-day
                      style={{ gridColumn: dayIndex + 1, gridRow: `1 / ${spacerRow + 1}` }}
                      className={`relative border-r border-border-subtle last:border-r-0 ${isSelected
                        ? "bg-brand-50/70 dark:bg-brand-950/20"
                        : day.inMonth
                          ? "bg-surface hover:bg-surface-hover"
                          : "bg-surface-subtle/70 text-faint"}`}
                    >
                      {editable && (
                        <Link
                          href={`${basePath}?${dayQuery}`}
                          aria-label={`${day.date} günü için etkinlik oluştur`}
                          className="absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
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
                      className="pointer-events-none relative z-10 flex items-center px-2"
                    >
                      <span className={`grid size-7 place-items-center rounded-full text-xs font-semibold tabular-nums ${isToday
                        ? "bg-brand-600 text-white"
                        : isSelected
                          ? "bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-200"
                          : day.inMonth
                            ? "text-secondary"
                            : "text-faint"}`}>
                        {Number(day.date.slice(-2))}
                      </span>
                    </div>
                  );
                })}

                {segments.map((segment) => {
                  const segmentDate = week[segment.startColumn - 1].date;
                  const eventQuery = new URLSearchParams(preservedQuery);
                  eventQuery.set("month", segmentDate.slice(0, 7));
                  eventQuery.set("day", segmentDate);
                  eventQuery.set("event", segment.event.id);
                  const time = segment.showTime ? eventTime(segment.event) : "";
                  const className = `pointer-events-auto relative z-20 mx-1 flex min-w-0 items-center gap-1 overflow-hidden px-2 text-[10px] font-semibold leading-5 ring-1 ring-inset ring-black/5 dark:ring-white/5 ${segment.event.brand_id ? "brand-stripe" : ""} ${calendarEventTone(segment.event)} ${segment.continuesBefore ? "rounded-l-none" : "rounded-l-md"} ${segment.continuesAfter ? "rounded-r-none" : "rounded-r-md"}`;
                  const content = (
                    <>
                      {time && <span className="shrink-0 tabular-nums opacity-75">{time}</span>}
                      <span className="truncate">{segment.event.title}</span>
                    </>
                  );
                  const style = {
                    gridColumn: `${segment.startColumn} / span ${segment.span}`,
                    gridRow: segment.lane + 2,
                  };

                  return editable ? (
                    <Link
                      key={`${segment.event.id}-${week[0].date}`}
                      href={`${basePath}?${eventQuery}`}
                      data-brand-accent={segment.event.brand_id ? "" : undefined}
                      className={className}
                      style={{ ...style, ...brandAccentStyle(segment.event.brand_accent_hue) }}
                      title={segment.event.title}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div
                      key={`${segment.event.id}-${week[0].date}`}
                      data-brand-accent={segment.event.brand_id ? "" : undefined}
                      className={className}
                      style={{ ...style, ...brandAccentStyle(segment.event.brand_accent_hue) }}
                      title={segment.event.title}
                    >
                      {content}
                    </div>
                  );
                })}

                <div
                  aria-hidden="true"
                  className="pointer-events-none col-span-7 min-h-12"
                  style={{ gridRow: spacerRow }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
