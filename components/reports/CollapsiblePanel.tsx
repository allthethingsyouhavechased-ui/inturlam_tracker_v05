"use client";

// Rapor ekranlarındaki grafik/dağılım kartları uzun; kullanıcı ilgilenmediği
// kartı kapatabilsin ve bu tercih kalıcı olsun diye başlığından katlanıyorlar.
// Tercihin `localStorage` deposu artık `lib/usePanelOpen.ts`'te — Panom'un
// kişisel teslim radarı da aynı depoyu kullanıyor.

import { REPORT_SURFACE_CLASS } from "@/lib/constants";
import { usePanelOpen } from "@/lib/usePanelOpen";

/**
 * Başlığına tıklanınca açılıp kapanan rapor kartı. `panelKey` tercihin
 * saklandığı ad — aynı anahtarı kullanan kartlar (ör. kişi ve departman
 * raporundaki "Teslim sağlığı") tek bir tercihi paylaşır, bilinçli.
 */
export default function CollapsiblePanel({
  panelKey,
  titleId,
  title,
  description,
  meta,
  actions,
  defaultOpen = true,
  bodyClassName = "px-4 pb-4",
  children,
}: {
  panelKey: string;
  titleId?: string;
  title: string;
  description?: string;
  /** Başlığın sağındaki kısa bilgi (sayı, rozet). Kapalıyken de görünür. */
  meta?: React.ReactNode;
  /** Sekme/filtre gibi bağımsız kontroller. Başlık düğmesinin dışında render edilir. */
  actions?: React.ReactNode;
  defaultOpen?: boolean;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const { open, toggle } = usePanelOpen(panelKey, defaultOpen);
  const bodyId = `panel-${panelKey}`;

  // `min-w-0`: kart bir grid çocuğu olduğunda taşmasın (bkz. CLAUDE.md).
  return (
    <section aria-labelledby={titleId} className={`${REPORT_SURFACE_CLASS} min-w-0`}>
      <div
        className={`flex min-w-0 flex-col border-b transition-colors lg:flex-row lg:items-center lg:justify-between ${
          open ? "border-border-subtle" : "border-transparent"
        }`}
      >
        <h2 className="min-w-0 flex-1">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={bodyId}
            className="ui-press flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
                className={`size-4 shrink-0 text-brand-600 transition-transform duration-200 dark:text-brand-300 ${
                  open ? "rotate-90" : ""
                }`}
              >
                <path d="M7.21 14.77a.75.75 0 0 1 0-1.06L10.94 10 7.21 6.29a.75.75 0 1 1 1.06-1.06l4.25 4.24a.75.75 0 0 1 0 1.06l-4.25 4.24a.75.75 0 0 1-1.06 0Z" />
              </svg>
              <span className="min-w-0">
                <span id={titleId} className="block text-base font-semibold">{title}</span>
                {description && (
                  <span className="block text-xs font-normal text-muted">
                    {description}
                  </span>
                )}
              </span>
            </span>
            {meta && <span className="shrink-0 text-xs font-medium text-brand-700 dark:text-brand-300">{meta}</span>}
          </button>
        </h2>
        {actions && open && (
          <div className="flex max-w-full shrink-0 items-center px-4 pb-3 lg:py-2 lg:pl-0">
            {actions}
          </div>
        )}
      </div>
      <div
        id={bodyId}
        aria-hidden={!open}
        className={`${open ? "ui-enter" : "hidden"} print:block ${bodyClassName}`}
      >
        {children}
      </div>
    </section>
  );
}
