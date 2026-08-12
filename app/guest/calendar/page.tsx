import Link from "next/link";
import EventCalendarGrid from "@/components/EventCalendarGrid";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import {
  calendarGridDays,
  formatMonthLabel,
  monthParamISO,
  monthParamToDate,
  shiftMonthParam,
  shiftISODate,
  shouldShowTodayShortcut,
  todayISO,
} from "@/lib/date";
import { requireGuestSession } from "@/lib/identity";
import { listGuestCalendarEvents } from "@/lib/repositories/calendarEvents";

export const dynamic = "force-dynamic";

export default async function GuestCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const actor = await requireGuestSession();
  const monthDate = monthParamToDate((await searchParams).month);
  const month = monthParamISO(monthDate);
  const todayMonth = todayISO().slice(0, 7);
  const days = calendarGridDays(monthDate);
  const events = listGuestCalendarEvents(actor.brand.id, days[0].date, shiftISODate(days.at(-1)!.date, 1));
  return (
    <div>
      <PageHeader
        eyebrow="MARKA PORTALI"
        title="Takvim"
        description="Ekibin markanızla açıkça paylaştığı toplantı ve çekimler."
        breadcrumb={[{ label: actor.brand.name, href: "/guest" }, { label: "Takvim" }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {shouldShowTodayShortcut(month, null, todayISO()) && <Link href={`/guest/calendar?month=${todayMonth}`} className="ui-press inline-flex min-h-10 items-center rounded-[10px] border border-border-default bg-surface px-3 text-xs font-semibold text-secondary hover:bg-surface-hover">Bugün</Link>}
            <nav aria-label="Takvim ayı" className="flex items-center rounded-[10px] border border-border-default bg-surface p-0.5">
              <Link href={`/guest/calendar?month=${shiftMonthParam(month, -1)}`} aria-label="Önceki ay" className="grid size-9 place-items-center rounded-lg hover:bg-surface-hover"><Icon name="chevron-left" className="size-4" /></Link>
              <span className="min-w-32 text-center text-sm font-semibold">{formatMonthLabel(monthDate)}</span>
              <Link href={`/guest/calendar?month=${shiftMonthParam(month, 1)}`} aria-label="Sonraki ay" className="grid size-9 place-items-center rounded-lg hover:bg-surface-hover"><Icon name="chevron-right" className="size-4" /></Link>
            </nav>
          </div>
        }
      />
      <EventCalendarGrid gridDays={days} events={events} basePath="/guest/calendar" editable={false} />
    </div>
  );
}
