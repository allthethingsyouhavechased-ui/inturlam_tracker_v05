import type { CalendarEvent } from "@/lib/types";

type CalendarRangeEvent = Pick<CalendarEvent, "start_at" | "end_at" | "all_day">;

function validISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function shiftDate(value: string, amount: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function istanbulDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "1970-01-01";
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function normalizedFormValue(value: FormDataEntryValue | string | null): string {
  return String(value ?? "").trim();
}

function normalizeTimed(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("Etkinlik tarih/saat bilgisi geçersiz.");
  }
  const parsed = new Date(`${value}:00+03:00`);
  if (Number.isNaN(parsed.getTime()) || istanbulDate(parsed) !== value.slice(0, 10)) {
    throw new Error("Etkinlik tarih/saat bilgisi geçersiz.");
  }
  return parsed.toISOString();
}

export function normalizeCalendarFormRange(
  startValue: FormDataEntryValue | string | null,
  endValue: FormDataEntryValue | string | null,
  allDay: boolean,
): { startAt: string; endAt: string } {
  const start = normalizedFormValue(startValue);
  const end = normalizedFormValue(endValue);
  if (allDay) {
    if (!validISODate(start) || !validISODate(end)) throw new Error("Etkinlik tarihi geçersiz.");
    if (end < start) throw new Error("Bitiş başlangıçtan önce olamaz.");
    return { startAt: start, endAt: shiftDate(end, 1) };
  }
  const startAt = normalizeTimed(start);
  const endAt = normalizeTimed(end);
  if (Date.parse(endAt) <= Date.parse(startAt)) throw new Error("Bitiş başlangıçtan sonra olmalı.");
  return { startAt, endAt };
}

export function calendarEventStartDate(event: CalendarRangeEvent): string {
  return event.all_day === 1 ? event.start_at.slice(0, 10) : istanbulDate(event.start_at);
}

export function calendarEventEndDate(event: CalendarRangeEvent): string {
  if (event.all_day === 1) return shiftDate(event.end_at.slice(0, 10), -1);
  const end = new Date(event.end_at);
  if (Number.isNaN(end.getTime())) return calendarEventStartDate(event);
  return istanbulDate(new Date(end.getTime() - 1));
}

export function calendarFormEndDate(event: CalendarRangeEvent): string {
  return event.all_day === 1 ? calendarEventEndDate(event) : event.end_at;
}

export function eventOccursOnDate(event: CalendarRangeEvent, date: string): boolean {
  return date >= calendarEventStartDate(event) && date <= calendarEventEndDate(event);
}

/** Returns whether an event intersects an inclusive-start, exclusive-end date range. */
export function eventOverlapsDateRange(
  event: CalendarRangeEvent,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  return calendarEventEndDate(event) >= rangeStart
    && calendarEventStartDate(event) < rangeEnd;
}

export function normalizeCalendarRangeBoundary(value: string): string {
  return validISODate(value) ? new Date(`${value}T00:00:00+03:00`).toISOString() : value;
}
