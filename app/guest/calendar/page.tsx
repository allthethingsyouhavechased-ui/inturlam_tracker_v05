import CalendarMonthAgenda from "@/components/CalendarMonthAgenda";
import EventCalendarGrid from "@/components/EventCalendarGrid";
import MonthNavigator from "@/components/MonthNavigator";
import PageHeader from "@/components/ui/PageHeader";
import {
  calendarGridDays,
  monthParamISO,
  monthParamToDate,
  shiftISODate,
} from "@/lib/date";
import { requireGuestSession } from "@/lib/identity";
import { listGuestCalendarEvents } from "@/lib/repositories/calendarEvents";

export const dynamic = "force-dynamic";

export default async function GuestCalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const actor = await requireGuestSession();
  const monthDate = monthParamToDate((await searchParams).month);
  const month = monthParamISO(monthDate);
  const days = calendarGridDays(monthDate);
  const events = listGuestCalendarEvents(actor.brand.id, days[0].date, shiftISODate(days.at(-1)!.date, 1));
  return (
    <div>
      <PageHeader
        eyebrow="MARKA PORTALI"
        title="Takvim"
        description="Ekibin markanızla açıkça paylaştığı toplantı ve çekimler."
        breadcrumb={[{ label: actor.brand.name, href: "/guest" }, { label: "Takvim" }]}
        actions={<MonthNavigator month={month} basePath="/guest/calendar" ariaLabel="Takvim ayı" />}
      />
      <section aria-label="Paylaşılan etkinlik takvimi" className="min-w-0 overflow-hidden rounded-xl border border-border-default bg-surface">
        <div className="hidden lg:block">
          <EventCalendarGrid gridDays={days} events={events} basePath="/guest/calendar" editable={false} />
        </div>
        <div className="lg:hidden">
          <CalendarMonthAgenda month={month} events={events} preservedQuery="" basePath="/guest/calendar" editable={false} />
        </div>
      </section>
    </div>
  );
}
