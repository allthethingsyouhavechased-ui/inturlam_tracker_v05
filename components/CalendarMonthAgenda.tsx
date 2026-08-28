import Link from "next/link";
import EmptyState from "@/components/EmptyState";
import Icon from "@/components/ui/Icon";
import { brandAccentStyle } from "@/lib/brandAccent";
import { calendarEventTone } from "@/lib/calendar/colors";
import { calendarEventEndDate, calendarEventStartDate } from "@/lib/calendar/time";
import { shiftMonthParam } from "@/lib/date";
import type { CalendarEvent } from "@/lib/types";

function eventTime(event: CalendarEvent): string {
  if (event.all_day === 1) return "Tüm gün";
  return new Date(event.start_at).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}

function dateParts(date: string): { day: string; weekday: string } {
  const value = new Date(`${date}T12:00:00+03:00`);
  return {
    day: new Intl.DateTimeFormat("tr-TR", { day: "2-digit", timeZone: "Europe/Istanbul" }).format(value),
    weekday: new Intl.DateTimeFormat("tr-TR", { weekday: "short", timeZone: "Europe/Istanbul" }).format(value),
  };
}

export default function CalendarMonthAgenda({
  month,
  events,
  preservedQuery,
  basePath = "/calendar",
  editable = true,
}: {
  month: string;
  events: CalendarEvent[];
  preservedQuery: string;
  basePath?: string;
  editable?: boolean;
}) {
  const monthStart = `${month}-01`;
  const monthEnd = `${shiftMonthParam(month, 1)}-01`;
  const groups = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const start = calendarEventStartDate(event);
    const end = calendarEventEndDate(event);
    if (end < monthStart || start >= monthEnd) continue;
    const displayDate = start < monthStart ? monthStart : start;
    const group = groups.get(displayDate) ?? [];
    group.push(event);
    groups.set(displayDate, group);
  }

  const entries = [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, items]) => [
      date,
      [...items].sort((left, right) =>
        left.start_at.localeCompare(right.start_at)
        || left.title.localeCompare(right.title, "tr"),
      ),
    ] as const);

  return (
    <aside
      aria-labelledby="month-agenda-title"
      className="min-w-0 border-t border-border-default bg-surface-subtle/55 lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:border-l lg:border-t-0"
    >
      <div className="sticky top-0 z-10 border-b border-border-subtle bg-surface px-4 py-3">
        <h2 id="month-agenda-title" className="text-sm font-semibold text-foreground">Ay programı</h2>
        <p className="mt-0.5 text-[11px] text-muted">{events.length} etkinlik · {entries.length} aktif gün</p>
      </div>

      {entries.length === 0 ? (
        <div className="p-4">
          <EmptyState compact title="Bu ay etkinlik yok" description="Filtreleri temizleyebilir veya yeni bir etkinlik ekleyebilirsin." />
        </div>
      ) : (
        <div className="divide-y divide-border-subtle">
          {entries.map(([date, items]) => {
            const parts = dateParts(date);
            return (
              <section key={date} aria-labelledby={`agenda-${date}`} className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 px-3 py-3">
                <div className="pt-0.5 text-center">
                  <p className="font-display text-xl font-semibold leading-none tabular-nums text-foreground">{parts.day}</p>
                  <h3 id={`agenda-${date}`} className="mt-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-muted">{parts.weekday}</h3>
                </div>
                <ul className="min-w-0 space-y-1">
                  {items.map((event) => {
                    const query = new URLSearchParams(preservedQuery);
                    query.set("month", month);
                    query.set("day", date);
                    query.set("event", event.id);
                    const className = `ui-press block min-w-0 rounded-lg px-2.5 py-2 text-xs ${event.brand_id ? "brand-stripe" : ""} ${calendarEventTone(event)}`;
                    const content = (
                      <>
                        <span className="block truncate font-semibold">{event.title}</span>
                        <span className="mt-1 flex min-w-0 items-center gap-1 text-[10px] opacity-80">
                          <Icon name="clock" className="size-3" />
                          <span className="shrink-0 tabular-nums">{eventTime(event)}</span>
                          {event.brand_name && <span className="truncate">· {event.brand_name}</span>}
                        </span>
                      </>
                    );
                    return (
                      <li key={event.id}>
                        {editable ? <Link
                          href={`${basePath}?${query}`}
                          data-brand-accent={event.brand_id ? "" : undefined}
                          style={brandAccentStyle(event.brand_accent_hue)}
                          className={className}
                        >
                          {content}
                        </Link> : <div
                          data-brand-accent={event.brand_id ? "" : undefined}
                          style={brandAccentStyle(event.brand_accent_hue)}
                          className={className}
                        >
                          {content}
                        </div>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </aside>
  );
}
