import type { ReactNode } from "react";

export default function BrandWorkspaceSummary({
  overview,
  activity,
  shoots,
}: {
  overview: ReactNode;
  activity: ReactNode;
  shoots: ReactNode;
}) {
  return (
    <section
      aria-label="Marka bilgi özeti"
      className="min-w-0 border-t border-border-subtle pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0"
    >
      <div className="grid min-w-0 gap-4 sm:grid-cols-3 sm:items-start">
        <div data-brand-info="summary" className="min-w-0">
          <p className="text-eyebrow text-brand-600 dark:text-brand-300">MARKA ÖZETİ</p>
          {overview}
        </div>
        <div
          data-brand-info="activity"
          className="min-w-0"
        >
          <p className="text-eyebrow text-brand-600 dark:text-brand-300">AKTİFLİK</p>
          {activity}
        </div>
        <div data-brand-info="shoots" className="min-w-0">
          <p className="text-eyebrow text-brand-600 dark:text-brand-300">ÇEKİM HAKLARI</p>
          {shoots}
        </div>
      </div>
    </section>
  );
}
