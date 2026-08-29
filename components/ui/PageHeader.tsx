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
  descriptionClassName,
  actions,
  className,
  layout = "default",
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  breadcrumb?: Breadcrumb[];
  media?: ReactNode;
  summary?: ReactNode;
  summaryClassName?: string;
  descriptionClassName?: string;
  actions?: ReactNode;
  className?: string;
  layout?: "default" | "workspace";
}) {
  const workspaceLayout = layout === "workspace";

  return (
    <div
      className={cn(
        "mb-5 border-b border-border-subtle pb-5",
        workspaceLayout
          ? "grid gap-4 lg:grid-cols-[minmax(15rem,0.9fr)_minmax(0,2fr)_auto] lg:items-center lg:gap-5"
          : "flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
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
        {/* Boy/leading/tracking artık elle değil ölçek token'ından geliyor
            (`--text-eyebrow` / `--text-h1`, globals.css). Tracking boy-özel
            olduğu için tek bir sabit değer her boyda birden doğru olamıyor. */}
        {eyebrow && (
          <p className="mb-1.5 text-eyebrow text-brand-600 dark:text-brand-300">
            {eyebrow}
          </p>
        )}
        <h1 className="text-h1 text-balance text-foreground">{title}</h1>
        {description && (
          <p className={cn("mt-1.5 max-w-2xl text-[13px] leading-5 text-muted", descriptionClassName)}>
            {description}
          </p>
        )}
        </div>
      </div>
      {summary && <div className={cn("min-w-0", !workspaceLayout && "flex-1 lg:ml-auto", summaryClassName ?? (!workspaceLayout && "lg:max-w-3xl"))}>{summary}</div>}
      {actions && <div className={cn("flex w-full min-w-0 max-w-full flex-wrap items-center gap-2 lg:w-auto lg:shrink-0", workspaceLayout && "lg:justify-self-end")}>{actions}</div>}
    </div>
  );
}
