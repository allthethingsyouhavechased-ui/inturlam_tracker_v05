import type { ReactNode } from "react";

// Marka başlığının ALTINDAKİ tek satırlık bilgi şeridi: özet · aktiflik ·
// sorumlular · çekim hakkı, sağ uçta da markayı düzenleme girişi.
//
// 2026-08-29'a kadar bu bilgiler ikiye bölünmüştü — üçü PageHeader'ın içinde
// (başlığın yanında, dar bir sütunda), sorumlular ise ayrı bir şeritte. İki
// yarım şerit üst üste hem başlığı sıkıştırıyor hem de aralarında boşluk
// bırakıyordu; dördü aynı ızgarada tek satır olarak duruyor.
export default function BrandWorkspaceSummary({
  overview,
  activity,
  activityBadge,
  responsibles,
  shoots,
  action,
}: {
  overview: ReactNode;
  activity: ReactNode;
  /** Tarama durumu rozeti — başlığın YANINDA durur: aşağıdaki satır o zaman
      yalnız açıklama metnini taşır, rozet metnin önüne sıkışmaz. */
  activityBadge?: ReactNode;
  responsibles: ReactNode;
  shoots: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section
      aria-label="Marka bilgi özeti"
      className="mb-4 flex flex-wrap items-center justify-between gap-x-5 gap-y-3 border-b border-border-subtle pb-4"
    >
      <div className="grid min-w-0 flex-1 gap-x-5 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
        <div data-brand-info="summary" className="min-w-0">
          <p className="text-eyebrow text-brand-600 dark:text-brand-300">MARKA ÖZETİ</p>
          {overview}
        </div>
        <div data-brand-info="activity" className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <p className="text-eyebrow text-brand-600 dark:text-brand-300">AKTİFLİK</p>
            {activityBadge}
          </div>
          {activity}
        </div>
        <div data-brand-info="responsibles" className="min-w-0">
          <p className="text-eyebrow text-brand-600 dark:text-brand-300">MARKA SORUMLULARI</p>
          {responsibles}
        </div>
        <div data-brand-info="shoots" className="min-w-0">
          <p className="text-eyebrow text-brand-600 dark:text-brand-300">ÇEKİM HAKLARI</p>
          {shoots}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </section>
  );
}
