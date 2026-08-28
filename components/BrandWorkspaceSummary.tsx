import type { ReactNode } from "react";

export default function BrandWorkspaceSummary({
  overview,
  targets,
  activity,
  actions,
  embedded = false,
}: {
  overview: ReactNode;
  targets: ReactNode;
  activity: ReactNode;
  actions: ReactNode;
  embedded?: boolean;
}) {
  return (
    <section
      aria-label="Marka bilgi özeti"
      className={embedded
        ? "min-w-0 border-t border-border-subtle pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0"
        : "rounded-xl border border-border-default bg-surface p-4 lg:p-5"}
    >
      <div className="grid min-w-0 gap-5 md:grid-cols-2 xl:grid-cols-[1.15fr_1fr_0.9fr_1.05fr] xl:gap-0">
        <div data-brand-info="summary" className="min-w-0 xl:pr-5">
          <p className="text-eyebrow text-faint">MARKA ÖZETİ</p>
          {overview}
        </div>
        <div
          data-brand-info="targets"
          className="min-w-0 border-t border-border-subtle pt-5 md:border-l md:border-t-0 md:pl-5 md:pt-0 xl:px-5"
        >
          {targets}
        </div>
        <div
          data-brand-info="activity"
          className="min-w-0 border-t border-border-subtle pt-5 md:pr-5 xl:border-l xl:border-t-0 xl:px-5 xl:pt-0"
        >
          <p className="text-eyebrow text-faint">AKTİFLİK</p>
          {activity}
        </div>
        <div
          data-brand-info="actions"
          className="min-w-0 border-t border-border-subtle pt-5 md:border-l md:pl-5 xl:border-t-0 xl:pt-0"
        >
          <p className="text-eyebrow text-faint">HIZLI İŞLEMLER</p>
          {actions}
        </div>
      </div>
    </section>
  );
}
