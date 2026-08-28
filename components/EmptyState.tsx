import type { ReactNode } from "react";

export default function EmptyState({
  title,
  description,
  action,
  compact = false,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-border-default bg-surface-subtle px-6 text-center ${
        compact ? "min-h-32 py-5" : "min-h-52 py-8"
      }`}
    >
      <span
        className="grid size-10 place-items-center rounded-lg bg-surface-muted text-muted"
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor">
          <path
            d="M8 6h8M8 10h8M8 14h5M5 3h14a1 1 0 0 1 1 1v16l-4-2-4 2-4-2-4 2V4a1 1 0 0 1 1-1Z"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
        {description}
      </p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
