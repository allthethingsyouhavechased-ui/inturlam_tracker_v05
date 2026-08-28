"use client";

import type { WorkspaceView } from "@/lib/uiPreferences";

export default function WorkspaceViewToggle({
  view,
  onChange,
  ariaLabel = "Görev görünümü",
}: {
  view: WorkspaceView;
  onChange: (next: WorkspaceView) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex shrink-0 overflow-hidden rounded-lg border border-border-default bg-surface-subtle p-0.5 text-xs"
    >
      {(["pano", "liste"] as const).map((next) => (
        <button
          key={next}
          type="button"
          onClick={() => onChange(next)}
          aria-pressed={view === next}
          className={`ui-press min-h-11 rounded-md px-3 font-semibold md:min-h-10 ${
            view === next
              ? "bg-surface text-foreground shadow-[0_1px_2px_rgb(35_30_24/0.10)]"
              : "text-muted hover:bg-surface-hover hover:text-secondary"
          }`}
        >
          {next === "pano" ? "Pano" : "Liste"}
        </button>
      ))}
    </div>
  );
}
