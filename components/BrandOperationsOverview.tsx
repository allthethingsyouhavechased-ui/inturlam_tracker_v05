import Link from "next/link";
import MonthNavigator from "@/components/MonthNavigator";
import PersonAvatar from "@/components/PersonAvatar";
import Icon from "@/components/ui/Icon";
import {
  CONTENT_STATUS_BADGE,
  CONTENT_STATUS_LABEL,
  TASK_STATUS_LABEL,
} from "@/lib/constants";
import { formatDateLong, formatIsoDateTime, formatMonthLabel, monthParamToDate } from "@/lib/date";
import type { ContentItemWithCounts } from "@/lib/repositories/content";
import type { TaskContribution } from "@/lib/repositories/progress";
import type {
  Brand,
  BrandPersonAssignment,
  CalendarEvent,
  ContentStatus,
  MonthlyProgress,
  TaskStatus,
} from "@/lib/types";
import { calendarEventStartDate } from "@/lib/calendar/time";

const TASK_STATUSES: TaskStatus[] = ["Beklemede", "DevamEdiyor", "Incelemede", "Onaylandi", "Yayinlandi"];
const CONTENT_STATUSES: ContentStatus[] = ["Planlandi", "Uretimde", "Tamamlandi", "IptalEdildi"];

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

export default function BrandOperationsOverview({
  brand,
  month,
  assignments,
  progress,
  contributions,
  monthlyContents,
  periodEvents,
  monthlyShootCount,
  annualShootCount,
}: {
  brand: Brand;
  month: string;
  assignments: BrandPersonAssignment[];
  progress: MonthlyProgress;
  contributions: TaskContribution[];
  monthlyContents: ContentItemWithCounts[];
  periodEvents: CalendarEvent[];
  monthlyShootCount: number;
  annualShootCount: number;
}) {
  const taskCounts = new Map<TaskStatus, number>();
  for (const task of contributions) taskCounts.set(task.status, (taskCounts.get(task.status) ?? 0) + 1);
  const contentCounts = new Map<ContentStatus, number>();
  for (const item of monthlyContents) contentCounts.set(item.status, (contentCounts.get(item.status) ?? 0) + 1);
  const monthLabel = formatMonthLabel(monthParamToDate(month));

  return (
    <section aria-labelledby="brand-operations-title" className="overflow-hidden rounded-xl border border-border-default bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-5">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.09em] text-brand-600 dark:text-brand-300">OPERASYON ÖZETİ</p>
          <h2 id="brand-operations-title" className="mt-0.5 text-sm font-semibold text-foreground">{monthLabel}</h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <MonthNavigator
            month={month}
            basePath={`/brands/${brand.id}`}
            ariaLabel={`${brand.name} operasyon analiz ayı`}
          />
          <Link href={calendarLink(month, brand.id, "Toplanti")} className="ui-press inline-flex min-h-9 items-center gap-1.5 rounded-[9px] border border-border-default bg-surface-subtle px-3 text-xs font-semibold text-secondary hover:border-brand-300 hover:text-foreground">
            <Icon name="calendar" className="size-3.5" /> Toplantılar
          </Link>
          <Link href={calendarLink(month, brand.id, "Cekim")} className="ui-press inline-flex min-h-9 items-center gap-1.5 rounded-[9px] border border-border-default bg-surface-subtle px-3 text-xs font-semibold text-secondary hover:border-brand-300 hover:text-foreground">
            <Icon name="calendar" className="size-3.5" /> Çekimler
          </Link>
          <Link href={`/brands/${brand.id}/reports?month=${month}`} className="ui-press inline-flex min-h-9 items-center gap-1.5 rounded-[9px] border border-border-default bg-surface-subtle px-3 text-xs font-semibold text-secondary hover:border-brand-300 hover:text-foreground">
            <Icon name="reports" className="size-3.5" /> Etkinlik raporları
          </Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.35fr_1fr_0.8fr]">
        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.08em] text-muted">AYLIK İŞ İLERLEMESİ</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{progress.percent === null ? "Bu ay plan yok" : `%${progress.percent}`}</p>
            </div>
            {progress.percent !== null && <span className="text-xs tabular-nums text-muted">{progress.weighted_earned}/{progress.weighted_total} puan</span>}
          </div>
          {progress.percent !== null && <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-subtle"><div className="h-full rounded-full bg-brand-600" style={{ width: `${progress.percent}%` }} /></div>}
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
            {TASK_STATUSES.map((status) => <span key={status}>{TASK_STATUS_LABEL[status]} <strong className="font-semibold text-secondary">{taskCounts.get(status) ?? 0}</strong></span>)}
          </div>
        </div>

        <div className="min-w-0 border-t border-border-subtle p-4 sm:p-5 lg:border-l lg:border-t-0">
          <p className="text-[10px] font-semibold tracking-[0.08em] text-muted">MARKA SORUMLULARI</p>
          {assignments.length > 0 ? (
            <div className="mt-3 space-y-2">
              {assignments.map((assignment) => (
                <Link key={assignment.person_id} href={`/team/${assignment.person_id}`} className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 hover:bg-surface-hover">
                  <PersonAvatar name={assignment.person_name} avatarPath={assignment.person_avatar_path} size="sm" />
                  <span className="min-w-0"><span className="block truncate text-xs font-semibold text-foreground">{assignment.person_name}</span><span className="block truncate text-[11px] text-muted">{assignment.person_title ?? "Ekip üyesi"}</span></span>
                </Link>
              ))}
            </div>
          ) : <p className="mt-3 text-sm text-muted">Henüz bir marka sorumlusu atanmadı.</p>}
        </div>

        <div className="min-w-0 border-t border-border-subtle p-4 sm:p-5 lg:border-l lg:border-t-0">
          <p className="text-[10px] font-semibold tracking-[0.08em] text-muted">ÇEKİM HAKLARI</p>
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-1 2xl:grid-cols-2">
            <div>
              <p className="text-[9px] font-semibold tracking-[0.08em] text-faint">AYLIK</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                {monthlyShootCount}
                {brand.monthly_shoot_allowance !== null && <span className="text-sm font-medium text-muted"> / {brand.monthly_shoot_allowance}</span>}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-muted">{brand.monthly_shoot_allowance === null ? "Hak tanımlanmadı" : "Planlanan / hak"}</p>
            </div>
            <div>
              <p className="text-[9px] font-semibold tracking-[0.08em] text-faint">YILLIK</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                {annualShootCount}
                {brand.annual_shoot_allowance !== null && <span className="text-sm font-medium text-muted"> / {brand.annual_shoot_allowance}</span>}
              </p>
              <p className="mt-1 text-[11px] leading-4 text-muted">{brand.annual_shoot_allowance === null ? "Hak tanımlanmadı" : "Planlanan / hak"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid border-t border-border-subtle lg:grid-cols-2">
        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-semibold tracking-[0.08em] text-muted">AYLIK İÇERİK AKIŞI</p><span className="text-xs tabular-nums text-muted">{monthlyContents.length} içerik</span></div>
          {monthlyContents.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {CONTENT_STATUSES.map((status) => <span key={status} className={`rounded-full px-2 py-1 text-[11px] font-semibold ${CONTENT_STATUS_BADGE[status]}`}>{CONTENT_STATUS_LABEL[status]} · {contentCounts.get(status) ?? 0}</span>)}
            </div>
          ) : <p className="mt-3 text-sm text-muted">Bu ay hedef tarihli içerik bulunmuyor.</p>}
        </div>

        <div className="min-w-0 border-t border-border-subtle p-4 sm:p-5 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-semibold tracking-[0.08em] text-muted">DÖNEM TAKVİMİ</p><Link href={calendarLink(month, brand.id)} className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-300">Takvimi aç</Link></div>
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
