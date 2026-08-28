import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { formatDateShort } from "@/lib/date";

interface GuestQueueTask {
  id: string;
  title: string;
  requested_date: string;
  brand_name: string;
}

interface LegacyQueueTask {
  id: string;
  title: string;
  brand_name: string;
}

export default function TaskPlanningQueue({
  guestTasks,
  legacyTasks,
}: {
  guestTasks: GuestQueueTask[];
  legacyTasks: LegacyQueueTask[];
}) {
  const total = guestTasks.length + legacyTasks.length;
  if (total === 0) return null;

  return (
    <details className="group relative">
      <summary className="ui-press flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-[10px] border border-border-default bg-surface px-3 text-xs font-semibold text-secondary shadow-sm hover:bg-surface-hover hover:text-foreground [&::-webkit-details-marker]:hidden">
        <Icon name="calendar" className="size-4 text-amber-500" />
        Tarih bekleyenler
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-amber-800 dark:bg-amber-950 dark:text-amber-300">{total}</span>
        <Icon name="chevron-down" className="size-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className="ui-enter absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[min(32rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border-default bg-surface shadow-xl">
        <div className="border-b border-border-subtle px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">Planlama kuyruğu</h2>
          <p className="mt-0.5 text-xs text-muted">Teslim tarihi atanmadığı için aktif planlara henüz girmeyen işler.</p>
        </div>
        <div className="max-h-[26rem] overflow-y-auto">
          {guestTasks.length > 0 && (
            <section aria-labelledby="guest-planning-title">
              <div className="flex items-center justify-between bg-amber-50/70 px-4 py-2 dark:bg-amber-950/20">
                <h3 id="guest-planning-title" className="text-[10px] font-semibold tracking-[0.08em] text-warning">GUEST TALEPLERİ</h3>
                <span className="text-[10px] font-semibold tabular-nums text-warning">{guestTasks.length}</span>
              </div>
              <div className="divide-y divide-border-subtle">{guestTasks.map((task) => <Link key={task.id} href={`/tasks/${task.id}`} className="group flex min-w-0 items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-hover"><span className="min-w-0"><span className="block truncate text-xs font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-300">{task.title}</span><span className="block truncate text-[10px] text-muted">{task.brand_name}</span></span><span className="shrink-0 text-[10px] tabular-nums text-muted">İstenen {formatDateShort(task.requested_date)}</span></Link>)}</div>
            </section>
          )}
          {legacyTasks.length > 0 && (
            <section aria-labelledby="legacy-planning-title">
              <div className="flex items-center justify-between bg-surface-subtle px-4 py-2">
                <h3 id="legacy-planning-title" className="text-[10px] font-semibold tracking-[0.08em] text-muted">ESKİ TARİHSİZ GÖREVLER</h3>
                <span className="text-[10px] font-semibold tabular-nums text-muted">{legacyTasks.length}</span>
              </div>
              <div className="divide-y divide-border-subtle">{legacyTasks.map((task) => <Link key={task.id} href={`/tasks/${task.id}`} className="group block px-4 py-2.5 hover:bg-surface-hover"><span className="block truncate text-xs font-semibold text-foreground group-hover:text-brand-600 dark:group-hover:text-brand-300">{task.title}</span><span className="block truncate text-[10px] text-muted">{task.brand_name}</span></Link>)}</div>
            </section>
          )}
        </div>
      </div>
    </details>
  );
}
