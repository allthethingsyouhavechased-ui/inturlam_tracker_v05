"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "@/components/ui/Button";
import { controlClass } from "@/components/ui/Input";

export type RangeKey = "all" | "week" | "month" | "custom";

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "week", label: "Bu hafta" },
  { key: "month", label: "Bu ay" },
  { key: "custom", label: "Özel aralık" },
];

const inputClass = controlClass("w-full sm:w-auto");

// Hem portföy raporunda hem kişi raporunda aynı dönem seçimi kullanılıyor.
// Seçim URL'de (`?range=`) tutuluyor: sunucu tarafındaki sorgular zaten
// searchParams'tan okuyor ve rapor linki paylaşılabilir kalıyor.
export default function RangeFilterBar({
  rangeKey,
  customStart,
  customEnd,
  children,
}: {
  rangeKey: RangeKey;
  customStart: string;
  customEnd: string;
  /** Sağ tarafa eklenen sayfaya özel eylemler (yazdır, CSV vb.). */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [start, setStart] = useState(customStart);
  const [end, setEnd] = useState(customEnd);

  const customRangeInvalid = Boolean(start && end && start > end);

  function setRange(key: RangeKey) {
    router.push(`${pathname}?range=${key}`);
  }

  function applyCustomRange() {
    if (!start || !end || customRangeInvalid) return;
    router.push(`${pathname}?range=custom&start=${start}&end=${end}`);
  }

  return (
    <section
      aria-label="Rapor filtreleri"
      className="sticky top-[calc(var(--header-h)+0.75rem)] z-20 flex flex-wrap items-center gap-1.5 rounded-xl border border-border-default bg-surface p-2.5 shadow-sm print:hidden"
    >
      <span className="mr-1 text-xs font-semibold uppercase tracking-wider text-muted">
        Dönem
      </span>
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => setRange(option.key)}
          aria-pressed={rangeKey === option.key}
          className={buttonClass({
            variant: rangeKey === option.key ? "primary" : "ghost",
            className:
              rangeKey === option.key
                ? "px-3 text-[13px]"
                : "px-3 text-[13px] text-brand-700 hover:bg-brand-500/10 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200",
          })}
        >
          {option.label}
        </button>
      ))}

      {rangeKey === "custom" && (
        <div className="flex w-full flex-wrap items-end gap-2 border-t border-border-subtle pt-3 lg:w-auto lg:border-0 lg:pt-0">
          <label className="grid min-w-0 flex-1 gap-1 text-xs text-muted sm:flex-none">
            Başlangıç
            <input
              type="date"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="grid min-w-0 flex-1 gap-1 text-xs text-muted sm:flex-none">
            Bitiş
            <input
              type="date"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              className={inputClass}
            />
          </label>
          <button
            type="button"
            onClick={applyCustomRange}
            disabled={!start || !end || customRangeInvalid}
            className={buttonClass({ className: "w-full sm:w-auto" })}
          >
            Uygula
          </button>
          {customRangeInvalid && (
            <span className="w-full text-xs text-danger">
              Bitiş tarihi başlangıçtan önce olamaz.
            </span>
          )}
        </div>
      )}

      <div className="flex w-full flex-wrap items-center gap-1 sm:ml-auto sm:w-auto">{children}</div>
    </section>
  );
}

// Excel dökümü indirme bağlantısı. Buton değil `<a download>`: dosyayı sunucu
// üretiyor (`/reports/export`), istemcide blob kurmaya gerek yok — ve `xlsx`
// yazıcısı (node:zlib) istemci paketine hiç girmiyor.
export function ExcelDownloadLink({
  rangeKey,
  customStart,
  customEnd,
  personId,
  departmentId,
}: {
  rangeKey: RangeKey;
  customStart: string;
  customEnd: string;
  /** Verilirse döküm yalnızca o kişinin işlerini kapsar. */
  personId?: string;
  /** Verilirse döküm o departmandaki kişilerin işlerini kapsar. */
  departmentId?: string;
}) {
  const params = new URLSearchParams();
  if (rangeKey !== "all") params.set("range", rangeKey);
  if (rangeKey === "custom" && customStart && customEnd) {
    params.set("start", customStart);
    params.set("end", customEnd);
  }
  if (personId) params.set("person", personId);
  if (departmentId) params.set("department", departmentId);
  const query = params.toString();

  return (
    <a
      href={`/reports/export${query ? `?${query}` : ""}`}
      // Sunucu Content-Disposition gönderiyor; `download` yalnızca ipucu.
      download
      className={buttonClass({
        variant: "secondary",
        className:
          "gap-2 border-brand-500/35 bg-brand-500/[0.06] text-brand-700 hover:border-brand-500/60 hover:bg-brand-500/15 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200",
      })}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v7.19L6.53 7.22a.75.75 0 0 0-1.06 1.06l3.75 3.75a.75.75 0 0 0 1.06 0l3.75-3.75a.75.75 0 1 0-1.06-1.06l-2.72 2.72V2.75Z" />
        <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v1.5A2.75 2.75 0 0 0 4.75 17h10.5A2.75 2.75 0 0 0 18 14.25v-1.5a.75.75 0 0 0-1.5 0v1.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-1.5Z" />
      </svg>
      Excel dökümü
    </a>
  );
}

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={buttonClass({
        variant: "secondary",
        className:
          "gap-2 border-brand-500/35 bg-brand-500/[0.06] text-brand-700 hover:border-brand-500/60 hover:bg-brand-500/15 hover:text-brand-800 dark:text-brand-300 dark:hover:text-brand-200",
      })}
    >
      <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M5 2.75A.75.75 0 0 1 5.75 2h8.5a.75.75 0 0 1 .75.75V6h.75A2.25 2.25 0 0 1 18 8.25v5.5A2.25 2.25 0 0 1 15.75 16H15v1.25a.75.75 0 0 1-.75.75h-8.5a.75.75 0 0 1-.75-.75V16h-.75A2.25 2.25 0 0 1 2 13.75v-5.5A2.25 2.25 0 0 1 4.25 6H5V2.75ZM6.5 6h7V3.5h-7V6Zm0 7.5v3h7v-3h-7Z"
          clipRule="evenodd"
        />
      </svg>
      PDF / Yazdır
    </button>
  );
}
