import Link from "next/link";
import { notFound } from "next/navigation";
import ActionForm from "@/components/ActionForm";
import MonthNavigator from "@/components/MonthNavigator";
import SubmitButton from "@/components/SubmitButton";
import { buttonClass } from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import PageHeader from "@/components/ui/PageHeader";
import { saveCalendarEventReportAction } from "@/lib/actions/calendarEventReports";
import { formatDateLong, formatIsoDateTime, formatMonthLabel, monthParamISO, monthParamToDate, shiftMonthParam } from "@/lib/date";
import { requirePageSession } from "@/lib/identity";
import { getBrand } from "@/lib/repositories/brands";
import { listBrandCalendarEventReports } from "@/lib/repositories/calendarEventReports";

export const dynamic = "force-dynamic";

type EventFilter = "all" | "Toplanti" | "Cekim";

const fieldClass = "w-full rounded-[10px] border border-border-default bg-surface-elevated px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-faint focus:border-brand-500";

function eventFilter(value: string | undefined): EventFilter {
  return value === "Toplanti" || value === "Cekim" ? value : "all";
}

function filterHref(brandId: string, month: string, type: EventFilter): string {
  const query = new URLSearchParams({ month });
  if (type !== "all") query.set("type", type);
  return `/brands/${brandId}/reports?${query}`;
}

export default async function BrandEventReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ brandId: string }>;
  searchParams: Promise<{ month?: string; type?: string }>;
}) {
  await requirePageSession();
  const [{ brandId }, sp] = await Promise.all([params, searchParams]);
  const brand = getBrand(brandId);
  if (!brand) notFound();

  const month = monthParamISO(monthParamToDate(sp.month));
  const type = eventFilter(sp.type);
  const events = listBrandCalendarEventReports({
    brandId,
    rangeStart: `${month}-01`,
    rangeEnd: `${shiftMonthParam(month, 1)}-01`,
    type: type === "all" ? null : type,
  });
  const reportedCount = events.filter((event) => event.report_updated_at !== null).length;
  const meetingCount = events.filter((event) => event.event_type === "Toplanti").length;
  const shootCount = events.filter((event) => event.event_type === "Cekim").length;
  const monthLabel = formatMonthLabel(monthParamToDate(month));

  return (
    <div>
      <PageHeader
        eyebrow="MARKA OPERASYONU"
        title="Toplantı ve çekim raporları"
        description={`${brand.name} · ${monthLabel} etkinlik sonuçları, kararlar ve takip adımları.`}
        breadcrumb={[
          { label: "Markalar", href: "/brands" },
          { label: brand.name, href: `/brands/${brand.id}?month=${month}` },
          { label: "Etkinlik raporları" },
        ]}
        actions={(
          <>
            <MonthNavigator month={month} basePath={`/brands/${brand.id}/reports`} ariaLabel="Etkinlik raporu ayı" />
            <Link href={`/brands/${brand.id}?month=${month}`} className={buttonClass({ variant: "secondary", size: "sm" })}>Markaya dön</Link>
          </>
        )}
      />

      <div className="space-y-5">
      <section aria-label="Etkinlik raporu özeti" className="grid grid-cols-3 divide-x divide-border-subtle overflow-hidden rounded-xl border border-border-default bg-surface">
        <div className="px-4 py-3.5 sm:px-5"><p className="text-[10px] font-semibold tracking-[0.08em] text-muted">TOPLANTI</p><p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{meetingCount}</p></div>
        <div className="px-4 py-3.5 sm:px-5"><p className="text-[10px] font-semibold tracking-[0.08em] text-muted">ÇEKİM</p><p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{shootCount}</p></div>
        <div className="px-4 py-3.5 sm:px-5"><p className="text-[10px] font-semibold tracking-[0.08em] text-muted">RAPORLANDI</p><p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{reportedCount}<span className="text-sm font-medium text-muted"> / {events.length}</span></p></div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Etkinlik türü" className="inline-flex rounded-[10px] border border-border-default bg-surface p-1">
          {(["all", "Toplanti", "Cekim"] as const).map((item) => (
            <Link
              key={item}
              href={filterHref(brand.id, month, item)}
              aria-current={type === item ? "page" : undefined}
              className={`ui-press inline-flex min-h-8 items-center rounded-lg px-3 text-xs font-semibold ${type === item ? "bg-brand-600 text-white" : "text-muted hover:bg-surface-hover hover:text-foreground"}`}
            >
              {item === "all" ? "Tümü" : item === "Toplanti" ? "Toplantılar" : "Çekimler"}
            </Link>
          ))}
        </nav>
        <Link href={`/calendar?month=${month}&brand=${encodeURIComponent(brand.id)}`} className={buttonClass({ variant: "secondary", size: "sm" })}>
          <Icon name="calendar" className="size-3.5" /> Takvimde aç
        </Link>
      </div>

      {events.length === 0 ? (
        <section className="rounded-xl border border-dashed border-border-default bg-surface-subtle px-5 py-12 text-center">
          <p className="text-sm font-semibold text-foreground">Bu kapsamda etkinlik yok</p>
          <p className="mt-1 text-xs text-muted">Önce merkezi takvimde bu markaya bağlı bir toplantı veya çekim oluştur.</p>
          <Link href={`/calendar?month=${month}&brand=${encodeURIComponent(brand.id)}`} className={buttonClass({ variant: "secondary", size: "sm", className: "mt-4" })}>Takvime git</Link>
        </section>
      ) : (
        <section className="space-y-3" aria-label="Raporlanabilir etkinlikler">
          {events.map((event) => {
            const hasReport = event.report_updated_at !== null;
            const startLabel = event.all_day === 1 ? formatDateLong(event.start_at.slice(0, 10)) : formatIsoDateTime(event.start_at);
            const calendarUrl = `/calendar?month=${event.start_at.slice(0, 7)}&brand=${encodeURIComponent(brand.id)}&type=${event.event_type}&event=${encodeURIComponent(event.event_id)}`;
            return (
              <details key={event.event_id} id={`event-${event.event_id}`} className="group overflow-hidden rounded-xl border border-border-default bg-surface">
                <summary className="ui-press flex cursor-pointer list-none items-center gap-3 px-4 py-4 hover:bg-surface-hover sm:px-5 [&::-webkit-details-marker]:hidden">
                  <span className="grid size-9 shrink-0 place-items-center rounded-[9px] bg-surface-subtle text-muted"><Icon name={event.event_type === "Toplanti" ? "team" : "calendar"} className="size-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{event.event_title}</span>
                      <span className="rounded-full border border-border-default px-2 py-0.5 text-[10px] font-semibold text-muted">{event.event_type === "Toplanti" ? "Toplantı" : "Çekim"}</span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted">{startLabel}{event.location ? ` · ${event.location}` : ""}</span>
                  </span>
                  <span className={hasReport ? "shrink-0 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-success" : "shrink-0 rounded-full border border-border-default px-2 py-1 text-[10px] font-semibold text-muted"}>
                    {hasReport ? "Raporlandı" : "Rapor bekliyor"}
                  </span>
                  <Icon name="chevron-down" className="size-4 text-muted transition-transform group-open:rotate-180" />
                </summary>

                <div className="border-t border-border-subtle p-4 sm:p-5">
                  <ActionForm action={saveCalendarEventReportAction} successMessage="Etkinlik raporu kaydedildi." className="space-y-4">
                    <input type="hidden" name="eventId" value={event.event_id} />
                    <label className="grid gap-1.5 text-xs font-medium text-secondary">
                      Katılımcılar / ekip
                      <input name="participants" defaultValue={event.participants ?? ""} placeholder="Toplantıya veya çekime katılan kişiler" className={fieldClass} />
                    </label>
                    <label className="grid gap-1.5 text-xs font-medium text-secondary">
                      Rapor özeti
                      <textarea name="summary" rows={4} defaultValue={event.summary ?? ""} placeholder="Ne konuşuldu veya çekimde ne üretildi?" className={fieldClass} />
                    </label>
                    <div className="grid gap-4 lg:grid-cols-2">
                      <label className="grid gap-1.5 text-xs font-medium text-secondary">
                        {event.event_type === "Toplanti" ? "Kararlar" : "Çıktılar / teslimler"}
                        <textarea name="decisions" rows={3} defaultValue={event.decisions ?? ""} placeholder={event.event_type === "Toplanti" ? "Alınan kararlar" : "Üretilen çekim çıktıları"} className={fieldClass} />
                      </label>
                      <label className="grid gap-1.5 text-xs font-medium text-secondary">
                        Sonraki adımlar
                        <textarea name="nextSteps" rows={3} defaultValue={event.next_steps ?? ""} placeholder="Kim, neyi, ne zamana kadar yapacak?" className={fieldClass} />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
                      <div className="text-[11px] text-muted">
                        {hasReport ? `Son güncelleme: ${formatIsoDateTime(event.report_updated_at!)}${event.updated_by_name ? ` · ${event.updated_by_name}` : ""}` : "Bu rapor yalnızca ekip hesaplarına açıktır."}
                      </div>
                      <div className="flex items-center gap-2">
                        <Link href={calendarUrl} className={buttonClass({ variant: "secondary", size: "sm" })}>Etkinliği aç</Link>
                        <SubmitButton className={buttonClass({ size: "sm" })}>Raporu kaydet</SubmitButton>
                      </div>
                    </div>
                  </ActionForm>
                </div>
              </details>
            );
          })}
        </section>
      )}
      </div>
    </div>
  );
}
