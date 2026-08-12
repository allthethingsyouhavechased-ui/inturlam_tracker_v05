import Link from "next/link";
import CalendarDateTimeFields from "@/components/CalendarDateTimeFields";
import CalendarColorPicker from "@/components/CalendarColorPicker";
import CalendarSyncHealthCard from "@/components/CalendarSyncHealthCard";
import EventCalendarGrid from "@/components/EventCalendarGrid";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import { cancelCalendarEventAction, saveCalendarEventAction } from "@/lib/actions/calendar";
import {
  calendarGridDays,
  formatMonthLabel,
  monthParamISO,
  monthParamToDate,
  shiftMonthParam,
  shiftISODate,
  shouldShowTodayShortcut,
  todayISO,
  validISODateParam,
} from "@/lib/date";
import { requirePageSession } from "@/lib/identity";
import { listBrands } from "@/lib/repositories/brands";
import { getCalendarEvent, listCalendarEvents } from "@/lib/repositories/calendarEvents";
import type { CalendarEventType } from "@/lib/types";
import { calendarFormEndDate } from "@/lib/calendar/time";
import { getCalendarSyncHealth } from "@/lib/calendar/health";

export const dynamic = "force-dynamic";

const TYPES: Array<{ value: CalendarEventType; label: string }> = [
  { value: "Toplanti", label: "Toplantı" },
  { value: "Cekim", label: "Çekim" },
  { value: "Diger", label: "Diğer" },
];

function localDateTime(value: string | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date).replace(" ", "T");
}

function calendarHref(input: {
  month: string;
  brandId?: string | null;
  type?: CalendarEventType | null;
  day?: string | null;
}): string {
  const query = new URLSearchParams({ month: input.month });
  if (input.brandId) query.set("brand", input.brandId);
  if (input.type) query.set("type", input.type);
  if (input.day) query.set("day", input.day);
  return `/calendar?${query}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; brand?: string; type?: string; event?: string; day?: string }>;
}) {
  const me = await requirePageSession();
  const sp = await searchParams;
  const monthDate = monthParamToDate(sp.month);
  const month = monthParamISO(monthDate);
  const gridDays = calendarGridDays(monthDate);
  const brands = listBrands();
  const brandId = brands.some((brand) => brand.id === sp.brand) ? sp.brand! : null;
  const type = TYPES.some((item) => item.value === sp.type) ? sp.type as CalendarEventType : null;
  const events = listCalendarEvents({
    rangeStart: gridDays[0].date,
    rangeEnd: shiftISODate(gridDays.at(-1)!.date, 1),
    brandId,
    type,
  });
  const selectedEvent = sp.event ? getCalendarEvent(sp.event) : undefined;
  const selected = selectedEvent?.deleted_at ? undefined : selectedEvent;
  const today = todayISO();
  const todayMonth = today.slice(0, 7);
  const requestedDay = validISODateParam(sp.day);
  const selectedDay = requestedDay && gridDays.some((day) => day.date === requestedDay)
    ? requestedDay
    : null;
  const showToday = shouldShowTodayShortcut(month, selectedDay, today);
  const preservedQuery = new URLSearchParams();
  if (brandId) preservedQuery.set("brand", brandId);
  if (type) preservedQuery.set("type", type);

  return (
    <div>
      <PageHeader
        eyebrow="OPERASYON TAKVİMİ"
        title="Takvim"
        description="Toplantı, çekim ve diğer etkinlikleri merkezi takvimde planla. Görev teslim tarihleri bu takvimde gösterilmez."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {showToday && (
              <Link
                href={calendarHref({ month: todayMonth, brandId, type, day: today })}
                className="ui-press inline-flex min-h-10 items-center rounded-[10px] border border-border-default bg-surface px-3 text-xs font-semibold text-secondary hover:bg-surface-hover hover:text-foreground"
              >
                Bugün
              </Link>
            )}
            <nav aria-label="Takvim ayı" className="flex items-center rounded-[10px] border border-border-default bg-surface p-0.5">
              <Link
                href={calendarHref({ month: shiftMonthParam(month, -1), brandId, type })}
                aria-label="Önceki ay"
                className="grid size-9 place-items-center rounded-lg hover:bg-surface-hover"
              >
                <Icon name="chevron-left" className="size-4" />
              </Link>
              <span className="min-w-32 text-center text-sm font-semibold">{formatMonthLabel(monthDate)}</span>
              <Link
                href={calendarHref({ month: shiftMonthParam(month, 1), brandId, type })}
                aria-label="Sonraki ay"
                className="grid size-9 place-items-center rounded-lg hover:bg-surface-hover"
              >
                <Icon name="chevron-right" className="size-4" />
              </Link>
            </nav>
          </div>
        }
      />

      {me.is_manager === 1 && <CalendarSyncHealthCard health={getCalendarSyncHealth()} />}

      <form method="get" className="mb-4 grid items-end gap-2 rounded-xl border border-border-default bg-surface p-3 sm:grid-cols-[minmax(12rem,20rem)_minmax(9rem,13rem)_auto] sm:justify-start">
        <input type="hidden" name="month" value={month} />
        {selectedDay && <input type="hidden" name="day" value={selectedDay} />}
        <label className="grid min-w-0 gap-1 text-xs text-muted">
          Marka
          <select name="brand" defaultValue={brandId ?? ""} className="min-h-9 min-w-0 w-full rounded-lg border border-border-default bg-background px-2 text-sm">
            <option value="">Tüm markalar</option>
            {brands.map((brand) => <option key={brand.id} value={brand.id}>{brand.name}</option>)}
          </select>
        </label>
        <label className="grid min-w-0 gap-1 text-xs text-muted">
          Tür
          <select name="type" defaultValue={type ?? ""} className="min-h-9 min-w-0 w-full rounded-lg border border-border-default bg-background px-2 text-sm">
            <option value="">Tüm türler</option>
            {TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <button className="min-h-9 rounded-lg bg-surface-subtle px-3 text-xs font-semibold text-secondary hover:bg-surface-hover">Filtrele</button>
      </form>

      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <div className="min-w-0">
          <EventCalendarGrid
            gridDays={gridDays}
            events={events}
            preservedQuery={preservedQuery.toString()}
            selectedDate={selectedDay}
          />
        </div>
        <form
          action={saveCalendarEventAction}
          className="min-w-0 w-full space-y-4 rounded-xl border border-border-default bg-surface p-4 xl:sticky xl:top-20"
        >
          <div className="border-b border-border-subtle pb-3">
            <h2 className="text-sm font-semibold text-foreground">
              {selected ? "Etkinliği düzenle" : "Yeni etkinlik"}
            </h2>
            <p className="mt-1 text-xs leading-5 text-muted">
              Etkinliğin kapsamını, zamanını ve görünürlüğünü belirle.
            </p>
          </div>
          {selected && <input type="hidden" name="eventId" value={selected.id} />}
          <label className="grid min-w-0 gap-1.5 text-xs font-medium text-secondary">
            Başlık
            <input name="title" required maxLength={200} defaultValue={selected?.title ?? ""} className="min-h-10 min-w-0 w-full rounded-lg border border-border-default bg-background px-3 text-sm outline-none focus:border-brand-500" />
          </label>
          <div className="grid min-w-0 grid-cols-2 gap-3">
            <label className="grid min-w-0 gap-1.5 text-xs font-medium text-secondary">
              Tür
              <select name="type" defaultValue={selected?.type ?? "Toplanti"} className="min-h-10 min-w-0 w-full rounded-lg border border-border-default bg-background px-3 text-sm outline-none focus:border-brand-500">
                {TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <CalendarDateTimeFields
              key={selected?.id ?? selectedDay ?? "new-event"}
              brands={brands.map(({ id, name }) => ({ id, name }))}
              initialBrandId={selected?.brand_id ?? brandId ?? ""}
              initialGuestVisible={selected?.guest_visible === 1}
              initialAllDay={selected?.all_day === 1}
              initialStart={selected?.all_day === 1 ? selected.start_at.slice(0, 10) : selected ? localDateTime(selected.start_at) : selectedDay ? `${selectedDay}T09:00` : ""}
              initialEnd={selected?.all_day === 1 ? calendarFormEndDate(selected) : selected ? localDateTime(selected.end_at) : selectedDay ? `${selectedDay}T10:00` : ""}
            />
          </div>
          <CalendarColorPicker defaultValue={selected?.color_key ?? "auto"} />
          <label className="grid min-w-0 gap-1.5 text-xs font-medium text-secondary">Konum<input name="location" maxLength={300} defaultValue={selected?.location ?? ""} className="min-h-10 min-w-0 w-full rounded-lg border border-border-default bg-background px-3 text-sm outline-none focus:border-brand-500" /></label>
          <label className="grid min-w-0 gap-1.5 text-xs font-medium text-secondary">Açıklama<textarea name="description" maxLength={5000} rows={4} defaultValue={selected?.description ?? ""} className="min-w-0 w-full resize-y rounded-lg border border-border-default bg-background px-3 py-2 text-sm outline-none focus:border-brand-500" /></label>
          <button className="ui-press min-h-10 w-full rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700">{selected ? "Değişiklikleri kaydet" : "Etkinlik oluştur"}</button>
          {selected && <button formAction={cancelCalendarEventAction.bind(null, selected.id)} className="min-h-9 w-full rounded-lg border border-red-200 text-xs font-semibold text-red-700">Etkinliği iptal et</button>}
        </form>
      </div>
    </div>
  );
}
