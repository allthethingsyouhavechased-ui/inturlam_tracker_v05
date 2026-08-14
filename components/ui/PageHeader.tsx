import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface Breadcrumb {
  label: string;
  href?: string;
}

// Sayfa başlığının tek karşılığı — öncesinde 14 dosya kendi
// `text-2xl font-semibold tracking-tight` bloğunu, 5 farklı çevre düzeniyle
// (breadcrumb burada, eyebrow orada, description bazen hiç yok) elle
// yazıyordu. Her yeni sayfa bunu kullanır; ihtiyaç duymadığın prop'u atla.
export default function PageHeader({
  eyebrow,
  title,
  description,
  breadcrumb,
  media,
  summary,
  summaryClassName,
  actions,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  breadcrumb?: Breadcrumb[];
  media?: ReactNode;
  summary?: ReactNode;
  summaryClassName?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-7 flex flex-col gap-4 border-b border-border-subtle pb-5 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-3.5">
        {media && <div className="shrink-0 pt-0.5">{media}</div>}
        <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.label} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden="true">/</span>}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-foreground">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-secondary">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        {eyebrow && (
          <p className="mb-1.5 text-[11px] font-semibold tracking-[0.08em] text-brand-600 dark:text-brand-300">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[26px] font-semibold leading-8 tracking-[-0.025em] text-foreground">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-muted">{description}</p>}
        </div>
      </div>
      {summary && <div className={cn("min-w-0 flex-1 sm:ml-auto", summaryClassName ?? "sm:max-w-3xl")}>{summary}</div>}
      {actions && <div className="flex w-full min-w-0 max-w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">{actions}</div>}
    </div>
  );
}
