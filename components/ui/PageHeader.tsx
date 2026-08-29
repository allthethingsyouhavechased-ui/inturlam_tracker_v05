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
  // "brand": künye sütunu (logo + breadcrumb + eyebrow) ile BAŞLIK yan yana
  // durur, üst üste değil. Marka çalışma alanında başlık bloğu dört satıra
  // çıkıp sağdaki tek sıra düğmenin altında koca bir boşluk bırakıyordu.
  layout?: "default" | "workspace" | "brand";
}) {
  const workspaceLayout = layout === "workspace";
  const brandLayout = layout === "brand";

  const heading = (
    <>
      <h1 className="text-h1 text-balance text-foreground">{title}</h1>
      {description && (
        <p className={cn("mt-1.5 max-w-2xl text-[13px] leading-5 text-muted", descriptionClassName)}>
          {description}
        </p>
      )}
    </>
  );

  return (
    <div
      className={cn(
        "border-b border-border-subtle",
        brandLayout ? "mb-4 pb-3" : "mb-5 pb-5",
        workspaceLayout
          ? "grid gap-4 lg:grid-cols-[minmax(15rem,0.9fr)_minmax(0,2fr)_auto] lg:items-center lg:gap-5"
          : brandLayout
            ? "flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6"
            : "flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className={cn("flex min-w-0 gap-3.5", brandLayout ? "shrink-0 items-center" : "items-start")}>
        {media && <div className={cn("shrink-0", !brandLayout && "pt-0.5")}>{media}</div>}
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
          <p className={cn("text-eyebrow text-brand-600 dark:text-brand-300", !brandLayout && "mb-1.5")}>
            {eyebrow}
          </p>
        )}
        {!brandLayout && heading}
        </div>
      </div>
      {brandLayout && <div className="min-w-0 lg:flex-1">{heading}</div>}
      {summary && <div className={cn("min-w-0", !workspaceLayout && "flex-1 lg:ml-auto", summaryClassName ?? (!workspaceLayout && "lg:max-w-3xl"))}>{summary}</div>}
      {actions && <div className={cn("flex w-full min-w-0 max-w-full flex-wrap items-center gap-2 lg:w-auto lg:shrink-0", workspaceLayout && "lg:justify-self-end")}>{actions}</div>}
    </div>
  );
}
