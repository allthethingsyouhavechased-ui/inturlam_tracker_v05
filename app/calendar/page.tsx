import Link from "next/link";
import CalendarEventDialog from "@/components/CalendarEventDialog";
import CalendarFilterBar from "@/components/CalendarFilterBar";
import CalendarMonthAgenda from "@/components/CalendarMonthAgenda";
import CalendarSyncHealthCard from "@/components/CalendarSyncHealthCard";
import EventCalendarGrid from "@/components/EventCalendarGrid";
import MonthNavigator from "@/components/MonthNavigator";
import { buttonClass } from "@/components/ui/Button";
import PageHeader from "@/components/ui/PageHeader";
import { getCalendarSyncHealth } from "@/lib/calendar/health";
import { eventOverlapsDateRange } from "@/lib/calendar/time";
import {
  calendarGridDays,
  monthParamISO,
  monthParamToDate,
  shiftISODate,
  shiftMonthParam,
  shouldShowTodayShortcut,
  todayISO,
  validISODateParam,
} from "@/lib/date";
import { requirePageSession } from "@/lib/identity";
import { listBrands } from "@/lib/repositories/brands";
import { getCalendarEvent, listCalendarEvents } from "@/lib/repositories/calendarEvents";
import type { CalendarEventType } from "@/lib/types";

export const dynamic = "force-dynamic";

const TYPES: ReadonlyArray<{ value: CalendarEventType; label: string }> = [
  { value: "Toplanti", label: "Toplantı" },
  { value: "Cekim", label: "Çekim" },
  { value: "Diger", label: "Diğer" },
];

function calendarHref(input: {
  month: string;
  brandId?: string | null;
  type?: CalendarEventType | null;
  day?: string | null;
  q?: string;
}): string {
  const query = new URLSearchParams({ month: input.month });
  if (input.brandId) query.set("brand", input.brandId);
  if (input.type) query.set("type", input.type);
  if (input.day) query.set("day", input.day);
  if (input.q) query.set("q", input.q);
  return `/calendar?${query}`;
}

// SQLite NOCASE Türkçe İ/ı karakterlerini katlamadığı için ayın küçük etkinlik
// kümesini uygulama katmanında süzüyoruz.
export function matchesCalendarQuery(
  event: { title: string; location?: string | null; brand_name?: string | null },
  query: string,
): boolean {
  const needle = query.trim().toLocaleLowerCase("tr-TR");
  if (!needle) return true;
  return [event.title, event.location, event.brand_name]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("tr-TR")
    .includes(needle);
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; brand?: string; type?: string; event?: string; day?: string; q?: string }>;
}) {
  const me = await requirePageSession();
  const sp = await searchParams;
  const monthDate = monthParamToDate(sp.month);
  const month = monthParamISO(monthDate);
  const gridDays = calendarGridDays(monthDate);
  const brands = [...listBrands()].sort((left, right) =>
    left.name.localeCompare(right.name, "tr", { sensitivity: "base" }),
  );
  const brandId = brands.some((brand) => brand.id === sp.brand) ? sp.brand! : null;
  const type = TYPES.some((item) => item.value === sp.type) ? sp.type as CalendarEventType : null;
  const query = (sp.q ?? "").trim();
  const events = listCalendarEvents({
    rangeStart: gridDays[0].date,
    rangeEnd: shiftISODate(gridDays.at(-1)!.date, 1),
    brandId,
    type,
  }).filter((event) => matchesCalendarQuery(event, query));
  const selectedEvent = sp.event ? getCalendarEvent(sp.event) : undefined;
  const selected = selectedEvent?.deleted_at ? undefined : selectedEvent;
  const today = todayISO();
  const requestedDay = validISODateParam(sp.day);
  const selectedDay = requestedDay && gridDays.some((day) => day.date === requestedDay)
    ? requestedDay
    : null;
  const showToday = shouldShowTodayShortcut(month, selectedDay, today);
  const defaultDay = month === today.slice(0, 7) ? today : `${month}-01`;
  const preservedQuery = new URLSearchParams();
  if (brandId) preservedQuery.set("brand", brandId);
  if (type) preservedQuery.set("type", type);
  if (query) preservedQuery.set("q", query);

  const dialogKey = selected?.id ?? selectedDay ?? "new";
  const compactBrands = brands.map(({ id, name }) => ({ id, name }));
  const monthStart = `${month}-01`;
  const monthEnd = `${shiftMonthParam(month, 1)}-01`;
  const monthEvents = events.filter((event) => eventOverlapsDateRange(event, monthStart, monthEnd));
  const meetingCount = monthEvents.filter((event) => event.type === "Toplanti").length;
  const shootCount = monthEvents.filter((event) => event.type === "Cekim").length;

  return (
    <div>
      <PageHeader
        eyebrow="OPERASYON TAKVİMİ"
        title="Takvim"
        description="Toplantı, çekim ve diğer etkinlikleri merkezi takvimde planla. Görev teslim tarihleri bu takvimde gösterilmez."
      />

      <div className="space-y-5">
      {me.is_manager === 1 && <CalendarSyncHealthCard health={getCalendarSyncHealth()} />}

      <section aria-label="Takvim çalışma alanı" className="min-w-0 overflow-hidden rounded-xl border border-border-default bg-surface">
        <div className="flex min-w-0 flex-wrap items-center gap-3 border-b border-border-default px-3 py-3 sm:px-4">
          <MonthNavigator
            month={month}
            basePath="/calendar"
            ariaLabel="Takvim ayı"
            preservedQuery={preservedQuery.toString()}
          />
          <p className="min-w-0 text-[11px] tabular-nums text-muted">
            <strong className="font-semibold text-secondary">{monthEvents.length} etkinlik</strong>
            <span className="hidden sm:inline"> · {meetingCount} toplantı · {shootCount} çekim</span>
          </p>
          <div className="ml-auto flex items-center gap-2">
            {showToday && (
              <Link
                href={calendarHref({ month: today.slice(0, 7), brandId, type, day: today, q: query })}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                Bugün
              </Link>
            )}
            <CalendarEventDialog
              key={dialogKey}
              brands={compactBrands}
              types={TYPES}
              selectedEvent={selected}
              selectedDay={selectedDay}
              defaultBrandId={brandId ?? ""}
              defaultDay={defaultDay}
            />
          </div>
        </div>

        <div className="border-b border-border-default bg-surface-subtle px-3 py-2.5 sm:px-4">
          <CalendarFilterBar
            month={month}
            brands={compactBrands}
            types={TYPES}
            brandId={brandId}
            type={type}
            query={query}
          />
        </div>

        <div className="grid min-w-0 items-start lg:grid-cols-[minmax(0,1fr)_18rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="hidden min-w-0 lg:block">
            <EventCalendarGrid
              gridDays={gridDays}
              events={events}
              preservedQuery={preservedQuery.toString()}
              selectedDate={selectedDay}
            />
          </div>
          <CalendarMonthAgenda month={month} events={monthEvents} preservedQuery={preservedQuery.toString()} />
        </div>
      </section>
      </div>
    </div>
  );
}
