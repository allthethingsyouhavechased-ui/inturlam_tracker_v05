import { CALENDAR_EVENT_COLORS } from "@/lib/calendar/colors";
import type { CalendarEventColor } from "@/lib/types";

function ColorSwatch({ color }: { color: CalendarEventColor }) {
  if (color === "auto") {
    return (
      <span
        aria-hidden="true"
        className="grid size-4 shrink-0 grid-cols-3 overflow-hidden rounded-full ring-1 ring-black/10 dark:ring-white/20"
      >
        <span className="bg-sky-500" />
        <span className="bg-violet-500" />
        <span className="bg-zinc-500" />
      </span>
    );
  }
  const item = CALENDAR_EVENT_COLORS.find((candidate) => candidate.key === color)!;
  return (
    <span
      aria-hidden="true"
      className={`size-4 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/20 ${item.dotClass}`}
    />
  );
}

export default function CalendarColorPicker({
  defaultValue,
}: {
  defaultValue: CalendarEventColor;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1.5 text-xs font-medium text-secondary">Etkinlik rengi</legend>
      <div className="grid grid-cols-2 gap-2" data-calendar-color-palette>
        {CALENDAR_EVENT_COLORS.map((color) => (
          <label
            key={color.key}
            className="ui-press flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border-default bg-background px-2.5 text-[11px] font-medium text-secondary hover:bg-surface-hover has-[:checked]:border-brand-500 has-[:checked]:bg-brand-500/10 has-[:checked]:text-foreground has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500"
          >
            <input
              type="radio"
              name="colorKey"
              value={color.key}
              defaultChecked={color.key === defaultValue}
              className="sr-only"
            />
            <ColorSwatch color={color.key} />
            <span className="truncate">{color.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
