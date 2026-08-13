import Link from "next/link";
import Icon from "@/components/ui/Icon";
import {
  formatMonthLabel,
  monthParamToDate,
  shiftMonthParam,
  todayISO,
} from "@/lib/date";

function hrefForMonth(basePath: string, month: string): string {
  const query = new URLSearchParams({ month });
  return `${basePath}?${query}`;
}

export default function MonthNavigator({
  month,
  basePath,
  ariaLabel = "Analiz ayı",
}: {
  month: string;
  basePath: string;
  ariaLabel?: string;
}) {
  const currentMonth = todayISO().slice(0, 7);

  return (
    <nav aria-label={ariaLabel} className="flex min-w-0 items-center gap-2">
      {month !== currentMonth && (
        <Link
          href={hrefForMonth(basePath, currentMonth)}
          className="ui-press inline-flex min-h-9 items-center rounded-lg border border-border-default bg-surface px-2.5 text-[11px] font-semibold text-secondary hover:bg-surface-hover hover:text-foreground"
        >
          Bu ay
        </Link>
      )}
      <div className="flex min-w-0 items-center rounded-[10px] border border-border-default bg-surface p-0.5">
        <Link
          href={hrefForMonth(basePath, shiftMonthParam(month, -1))}
          aria-label="Önceki ay"
          className="ui-press grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-foreground"
        >
          <Icon name="chevron-left" className="size-4" />
        </Link>
        <span className="min-w-28 truncate px-1 text-center text-xs font-semibold text-foreground">
          {formatMonthLabel(monthParamToDate(month))}
        </span>
        <Link
          href={hrefForMonth(basePath, shiftMonthParam(month, 1))}
          aria-label="Sonraki ay"
          className="ui-press grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-hover hover:text-foreground"
        >
          <Icon name="chevron-right" className="size-4" />
        </Link>
      </div>
    </nav>
  );
}
