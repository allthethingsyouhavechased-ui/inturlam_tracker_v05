import type { CalendarEvent, CalendarEventColor, CalendarEventType } from "@/lib/types";

export const CALENDAR_EVENT_COLORS: ReadonlyArray<{
  key: CalendarEventColor;
  label: string;
  dotClass: string;
}> = [
  { key: "auto", label: "Türe göre otomatik", dotClass: "bg-zinc-400" },
  { key: "lavender", label: "Lavanta", dotClass: "bg-[#7986cb]" },
  { key: "sage", label: "Adaçayı", dotClass: "bg-[#33b679]" },
  { key: "purple", label: "Mor", dotClass: "bg-[#8e24aa]" },
  { key: "coral", label: "Mercan", dotClass: "bg-[#e67c73]" },
  { key: "amber", label: "Sarı", dotClass: "bg-[#f6c026]" },
  { key: "orange", label: "Turuncu", dotClass: "bg-[#f5511d]" },
  { key: "cyan", label: "Turkuaz", dotClass: "bg-[#039be5]" },
  { key: "slate", label: "Gri", dotClass: "bg-[#616161]" },
  { key: "blue", label: "Mavi", dotClass: "bg-[#3f51b5]" },
  { key: "green", label: "Yeşil", dotClass: "bg-[#0b8043]" },
  { key: "rose", label: "Kırmızı", dotClass: "bg-[#d60000]" },
];

const COLOR_KEYS = new Set(CALENDAR_EVENT_COLORS.map((item) => item.key));

export function isCalendarEventColor(value: unknown): value is CalendarEventColor {
  return typeof value === "string" && COLOR_KEYS.has(value as CalendarEventColor);
}

const COLOR_TONES: Record<Exclude<CalendarEventColor, "auto">, string> = {
  lavender: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300",
  sage: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
  purple: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  coral: "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300",
  amber: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300",
  orange: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300",
  cyan: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300",
  slate: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  green: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  rose: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
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
  lavender: "1",
  sage: "2",
  purple: "3",
  coral: "4",
  amber: "5",
  orange: "6",
  cyan: "7",
  slate: "8",
  blue: "9",
  green: "10",
  rose: "11",
};

export function googleColorId(color: CalendarEventColor): string | undefined {
  return color === "auto" ? undefined : GOOGLE_COLOR_IDS[color];
}

export function colorFromGoogle(colorId: string | undefined): CalendarEventColor {
  if (!colorId) return "auto";
  return (Object.entries(GOOGLE_COLOR_IDS).find(([, id]) => id === colorId)?.[0] as CalendarEventColor | undefined) ?? "auto";
}
