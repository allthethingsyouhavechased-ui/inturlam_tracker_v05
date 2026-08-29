import Link from "next/link";
import type { ReactNode } from "react";
import MonthNavigator from "@/components/MonthNavigator";
import Icon from "@/components/ui/Icon";
import { brandAccentStyle } from "@/lib/brandAccent";
import {
  CONTENT_STATUS_BADGE,
  CONTENT_STATUS_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUS_TEXT,
} from "@/lib/constants";
import { formatDateLong, formatIsoDateTime, formatMonthLabel, monthParamToDate } from "@/lib/date";
import type { ContentItemWithCounts } from "@/lib/repositories/content";
import type { TaskContribution } from "@/lib/repositories/progress";
import type {
  Brand,
  CalendarEvent,
  ContentStatus,
  MonthlyProgress,
  TaskStatus,
} from "@/lib/types";
import { calendarEventStartDate } from "@/lib/calendar/time";

const TASK_STATUSES: TaskStatus[] = ["Beklemede", "DevamEdiyor", "Incelemede", "Onaylandi", "Yayinlandi"];
const CONTENT_STATUSES: ContentStatus[] = ["Planlandi", "Uretimde", "Tamamlandi", "IptalEdildi"];
const OPERATION_CONTROL_CLASS =
  "ui-press inline-flex min-h-9 items-center gap-1.5 whitespace-nowrap rounded-[9px] border border-brand-500/30 bg-brand-500/[0.06] px-3 text-xs font-semibold text-brand-700 hover:border-brand-500/50 hover:bg-brand-500/10 dark:text-brand-300";

function calendarLink(month: string, brandId: string, type?: "Toplanti" | "Cekim"): string {
  const query = new URLSearchParams({ month, brand: brandId });
  if (type) query.set("type", type);
  return `/calendar?${query}`;
}

function eventDate(event: CalendarEvent): string {
  return event.all_day === 1
    ? formatDateLong(event.start_at.slice(0, 10))
    : formatIsoDateTime(event.start_at);
}

export function BrandMonthControl({ brand, month }: { brand: Brand; month: string }) {
  return (
    <div className="shrink-0 [&_a]:text-brand-700 [&_a:hover]:bg-brand-500/10 [&_a:hover]:text-brand-800 [&_div]:border-brand-500/30 [&_div]:bg-brand-500/[0.06] dark:[&_a]:text-brand-300">
      <MonthNavigator
        month={month}
        basePath={`/brands/${brand.id}`}
        ariaLabel={`${brand.name} operasyon analiz ayı`}
      />
    </div>
  );
}

export function BrandOperationLinks({ brand, month }: { brand: Brand; month: string }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 sm:justify-end">
      <Link href={calendarLink(month, brand.id, "Toplanti")} className={OPERATION_CONTROL_CLASS}>
        <Icon name="calendar" className="size-3.5" /> Toplantılar
      </Link>
      <Link href={calendarLink(month, brand.id, "Cekim")} className={OPERATION_CONTROL_CLASS}>
        <Icon name="calendar" className="size-3.5" /> Çekimler
      </Link>
      <Link href={`/brands/${brand.id}/reports?month=${month}`} className={OPERATION_CONTROL_CLASS}>
        <Icon name="reports" className="size-3.5" /> Etkinlik raporları
      </Link>
    </div>
  );
}

export default function BrandOperationsOverview({
  brand,
  month,
  progress,
  contributions,
  monthlyContents,
  periodEvents,
  targets,
}: {
  brand: Brand;
  month: string;
  progress: MonthlyProgress;
  contributions: TaskContribution[];
  monthlyContents: ContentItemWithCounts[];
  periodEvents: CalendarEvent[];
  targets?: ReactNode;
}) {
  const taskCounts = new Map<TaskStatus, number>();
  for (const task of contributions) taskCounts.set(task.status, (taskCounts.get(task.status) ?? 0) + 1);
  const contentCounts = new Map<ContentStatus, number>();
  for (const item of monthlyContents) contentCounts.set(item.status, (contentCounts.get(item.status) ?? 0) + 1);
  const monthLabel = formatMonthLabel(monthParamToDate(month));

  return (
    <section
      aria-labelledby="brand-operations-title"
      data-brand-accent
      style={brandAccentStyle(brand.accent_hue)}
      className="overflow-hidden rounded-xl border border-border-default bg-surface"
    >
      {/* Üç blok tek bir taban çizgisinde: sol başlık, ortadaki hedef sayaçları
          ve sağdaki ay gezgini. Önceden `1fr auto 1fr` ızgarasıydı ve ortadaki
          blok kendi hücresinde ortalandığı için iki yanında ölçüsüz boşluk
          kalıyor, üç blok birbiriyle hizasız görünüyordu. */}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3 border-b border-border-subtle px-4 py-3 sm:px-5">
        <div className="shrink-0">
          <p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">OPERASYON ÖZETİ · {brand.name}</p>
          <h2 id="brand-operations-title" className="mt-0.5 text-sm font-semibold text-foreground">{monthLabel}</h2>
        </div>
        {targets}
        <BrandMonthControl brand={brand} month={month} />
      </div>

      <div className="grid xl:grid-cols-[1.2fr_0.9fr_1.1fr]">
        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-eyebrow text-brand-600 dark:text-brand-300">AYLIK İŞ İLERLEMESİ</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{progress.percent === null ? "Bu ay plan yok" : `%${progress.percent}`}</p>
            </div>
            {progress.percent !== null && <span className="text-xs tabular-nums text-muted">{progress.weighted_earned}/{progress.weighted_total} puan</span>}
          </div>
          {progress.percent !== null && <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-subtle"><div className="brand-accent-fill h-full rounded-full" style={{ width: `${progress.percent}%` }} /></div>}
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
            {TASK_STATUSES.map((status) => (
              <span key={status}>
                <span className={`font-medium ${TASK_STATUS_TEXT[status]}`}>{TASK_STATUS_LABEL[status]}</span>{" "}
                <strong className="font-semibold text-secondary">{taskCounts.get(status) ?? 0}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="min-w-0 border-t border-border-subtle p-4 sm:p-5 xl:border-l xl:border-t-0">
          <div className="flex items-center justify-between gap-3">
            <p className="text-eyebrow text-brand-600 dark:text-brand-300">AYLIK İÇERİK AKIŞI</p>
            <span className="text-xs tabular-nums text-muted">{monthlyContents.length} içerik</span>
          </div>
          {monthlyContents.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {CONTENT_STATUSES.map((status) => (
                <div key={status} className="flex items-center justify-between gap-3 border-b border-border-subtle pb-2 last:border-0 last:pb-0">
                  <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${CONTENT_STATUS_BADGE[status]}`}>{CONTENT_STATUS_LABEL[status]}</span>
                  <span className="font-semibold tabular-nums text-foreground">{contentCounts.get(status) ?? 0}</span>
                </div>
              ))}
            </div>
          ) : <p className="mt-3 text-sm text-muted">Bu ay hedef tarihli içerik bulunmuyor.</p>}
        </div>

        <div className="min-w-0 border-t border-border-subtle p-4 sm:p-5 xl:border-l xl:border-t-0">
          <div className="flex items-center justify-between gap-3"><p className="text-eyebrow text-brand-600 dark:text-brand-300">DÖNEM TAKVİMİ</p><Link href={calendarLink(month, brand.id)} className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">Takvimi aç</Link></div>
          {periodEvents.length > 0 ? (
            <div className="mt-2 divide-y divide-border-subtle">
              {periodEvents.slice(0, 4).map((event) => { const startDate = calendarEventStartDate(event); return <Link key={event.id} href={`${calendarLink(startDate.slice(0, 7), brand.id)}&event=${encodeURIComponent(event.id)}`} className="flex min-w-0 items-center gap-3 py-2 hover:text-brand-600"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-subtle"><Icon name="calendar" className="size-4 text-muted" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-foreground">{event.title}</span><span className="block truncate text-[11px] text-muted">{event.type === "Toplanti" ? "Toplantı" : event.type === "Cekim" ? "Çekim" : "Diğer"} · {eventDate(event)}{event.location ? ` · ${event.location}` : ""}</span></span></Link>; })}
            </div>
          ) : <p className="mt-3 text-sm text-muted">{monthLabel} için planlanmış etkinlik yok.</p>}
        </div>
      </div>
    </section>
  );
}
