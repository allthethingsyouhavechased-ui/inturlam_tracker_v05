import Link from "next/link";
import Icon from "@/components/ui/Icon";
import {
  formatMonthLabel,
  monthParamToDate,
  shiftMonthParam,
  todayISO,
} from "@/lib/date";

export function hrefForMonth(basePath: string, month: string, preservedQuery = ""): string {
  const query = new URLSearchParams(preservedQuery);
  query.set("month", month);
  query.delete("day");
  query.delete("event");
  query.delete("yeni");
  return `${basePath}?${query}`;
}

export default function MonthNavigator({
  month,
  basePath,
  ariaLabel = "Analiz ayı",
  preservedQuery = "",
  scroll = true,
}: {
  month: string;
  basePath: string;
  ariaLabel?: string;
  preservedQuery?: string;
  scroll?: boolean;
}) {
  const currentMonth = todayISO().slice(0, 7);

  return (
    <nav aria-label={ariaLabel} className="flex min-w-0 items-center gap-2">
      {month !== currentMonth && (
        <Link
          href={hrefForMonth(basePath, currentMonth, preservedQuery)}
          scroll={scroll}
          className="ui-press inline-flex min-h-11 items-center rounded-md border border-border-default bg-surface px-2.5 text-[11px] font-semibold text-secondary hover:bg-surface-hover hover:text-foreground md:min-h-10"
        >
          Bu ay
        </Link>
      )}
      <div className="flex min-w-0 items-center rounded-md border border-border-default bg-surface p-0.5">
        <Link
          href={hrefForMonth(basePath, shiftMonthParam(month, -1), preservedQuery)}
          scroll={scroll}
          aria-label="Önceki ay"
          className="ui-press grid size-11 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-hover hover:text-foreground md:size-9"
        >
          <Icon name="chevron-left" className="size-4" />
        </Link>
        <span className="min-w-28 truncate px-1 text-center text-xs font-semibold text-foreground">
          {formatMonthLabel(monthParamToDate(month))}
        </span>
        <Link
          href={hrefForMonth(basePath, shiftMonthParam(month, 1), preservedQuery)}
          scroll={scroll}
          aria-label="Sonraki ay"
          className="ui-press grid size-11 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-hover hover:text-foreground md:size-9"
        >
          <Icon name="chevron-right" className="size-4" />
        </Link>
      </div>
    </nav>
  );
}
