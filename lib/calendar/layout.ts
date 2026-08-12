import { calendarEventEndDate, calendarEventStartDate } from "@/lib/calendar/time";
import type { CalendarGridDay } from "@/lib/date";
import type { CalendarEvent } from "@/lib/types";

export interface CalendarWeekEventSegment {
  event: CalendarEvent;
  startColumn: number;
  span: number;
  lane: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
  showTime: boolean;
}

export function calendarWeekEventSegments(
  events: CalendarEvent[],
  weekDays: CalendarGridDay[],
): CalendarWeekEventSegment[] {
  if (weekDays.length !== 7) throw new Error("Takvim haftası yedi gün olmalı.");

  const weekStart = weekDays[0].date;
  const weekEnd = weekDays[6].date;
  const occupiedThrough: number[] = [];

  return events
    .map((event) => {
      const eventStart = calendarEventStartDate(event);
      const eventEnd = calendarEventEndDate(event);
      if (eventEnd < weekStart || eventStart > weekEnd) return null;

      const visibleStart = eventStart < weekStart ? weekStart : eventStart;
      const visibleEnd = eventEnd > weekEnd ? weekEnd : eventEnd;
      return {
        event,
        eventStart,
        eventEnd,
        startColumn: weekDays.findIndex((day) => day.date === visibleStart) + 1,
        span: weekDays.findIndex((day) => day.date === visibleEnd)
          - weekDays.findIndex((day) => day.date === visibleStart) + 1,
      };
    })
    .filter((segment): segment is NonNullable<typeof segment> => segment !== null)
    .sort((left, right) =>
      left.startColumn - right.startColumn
      || right.span - left.span
      || left.event.start_at.localeCompare(right.event.start_at)
      || left.event.title.localeCompare(right.event.title, "tr"),
    )
    .map(({ event, eventStart, eventEnd, startColumn, span }) => {
      let lane = occupiedThrough.findIndex((column) => column < startColumn);
      if (lane === -1) lane = occupiedThrough.length;
      occupiedThrough[lane] = startColumn + span - 1;

      return {
        event,
        startColumn,
        span,
        lane,
        continuesBefore: eventStart < weekStart,
        continuesAfter: eventEnd > weekEnd,
        showTime: event.all_day !== 1 && eventStart >= weekStart && eventStart <= weekEnd,
      };
    });
}
