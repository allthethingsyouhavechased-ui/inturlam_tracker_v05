import type { CalendarEvent, CalendarEventColor, CalendarEventType } from "@/lib/types";

export const CALENDAR_EVENT_COLORS: ReadonlyArray<{
  key: CalendarEventColor;
  label: string;
  dotClass: string;
}> = [
  { key: "auto", label: "Türe göre otomatik", dotClass: "bg-zinc-400" },
  { key: "purple", label: "Mor", dotClass: "bg-violet-500" },
  { key: "blue", label: "Mavi", dotClass: "bg-blue-500" },
  { key: "cyan", label: "Turkuaz", dotClass: "bg-cyan-500" },
  { key: "green", label: "Yeşil", dotClass: "bg-emerald-500" },
  { key: "amber", label: "Sarı", dotClass: "bg-amber-500" },
  { key: "rose", label: "Kırmızı", dotClass: "bg-rose-500" },
  { key: "slate", label: "Gri", dotClass: "bg-slate-500" },
];

const COLOR_KEYS = new Set(CALENDAR_EVENT_COLORS.map((item) => item.key));

export function isCalendarEventColor(value: unknown): value is CalendarEventColor {
  return typeof value === "string" && COLOR_KEYS.has(value as CalendarEventColor);
}

const COLOR_TONES: Record<Exclude<CalendarEventColor, "auto">, string> = {
  purple: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  cyan: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
  slate: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
};

const TYPE_TONES: Record<CalendarEventType, string> = {
  Toplanti: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  Cekim: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  Diger: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export function calendarEventTone(event: Pick<CalendarEvent, "color_key" | "type">): string {
  return event.color_key === "auto" ? TYPE_TONES[event.type] : COLOR_TONES[event.color_key];
}

const GOOGLE_COLOR_IDS: Record<Exclude<CalendarEventColor, "auto">, string> = {
  purple: "3",
  blue: "9",
  cyan: "7",
  green: "10",
  amber: "5",
  rose: "11",
  slate: "8",
};

export function googleColorId(color: CalendarEventColor): string | undefined {
  return color === "auto" ? undefined : GOOGLE_COLOR_IDS[color];
}

export function colorFromGoogle(colorId: string | undefined): CalendarEventColor {
  if (!colorId) return "auto";
  return (Object.entries(GOOGLE_COLOR_IDS).find(([, id]) => id === colorId)?.[0] as CalendarEventColor | undefined) ?? "auto";
}
