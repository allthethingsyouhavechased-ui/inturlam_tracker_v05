import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "violet";

// Rozetlerin daha önce 4 farklı deseni vardı (bg-100+ring, bg-50+border,
// bg-500/10 tonu, ve rapor grafiklerindeki düz renk). Yeni bileşenler bunu
// kullanır; TASK_STATUS_BADGE gibi hâlâ literal-class gerektiren yerler
// (Tailwind runtime string üretimini taramaz) kendi sabitlerinde kalıyor.
const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-surface-muted text-secondary",
  brand: "bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  violet: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
};

export default function Badge({
  tone = "neutral",
  className,
  children,
  ...props
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
} & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold",
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
