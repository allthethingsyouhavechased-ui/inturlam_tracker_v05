"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import CountStepper from "@/components/CountStepper";
import { CONTENT_KINDS, CONTENT_KIND_LABEL } from "@/lib/socialPlan";
import type { BrandVarlikRow, ContentKind } from "@/lib/types";

type SortKey = "brand" | ContentKind | "delivery";
type SortDirection = "asc" | "desc";

// Hedefe göre renk: hedef hiç girilmemişse (0) nötr, hedefe ulaşıldıysa
// yeşil, altındaysa amber. `ready === 0` ayrıca soluklaştırılır — "hiç
// üretilmemiş" ile "biraz üretilmiş ama yetmiyor" görsel olarak ayrılsın.
function progressTone(ready: number, target: number): string {
  if (target <= 0) return "text-zinc-400 dark:text-zinc-500";
  if (ready >= target) return "text-success";
  if (ready === 0) return "text-zinc-500 dark:text-zinc-400";
  return "text-amber-600 dark:text-amber-400";
}

function compareRows(left: BrandVarlikRow, right: BrandVarlikRow, key: SortKey): number {
  if (key === "brand") return left.brand_name.localeCompare(right.brand_name, "tr", { sensitivity: "base" });
  if (key === "delivery") {
    return Number(left.monthly_content_completed) - Number(right.monthly_content_completed);
  }
  return left.ready[key] - right.ready[key];
}

export default function SocialVarlikTable({
  rows,
  monthLabel,
  setAssetCountAction,
}: {
  rows: BrandVarlikRow[];
  monthLabel: string;
  /** Sunucu action'ı prop olarak geçiyor: bu bileşen "use client". */
  setAssetCountAction: (brandId: string, kind: ContentKind, value: number) => Promise<void>;
}) {
  // Varsayılan sıralama marka adına göre — sayfa açıldığında liste her zaman
  // aynı, öngörülebilir sırada gelsin.
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({
    key: "brand",
    direction: "asc",
  });

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((left, right) => {
      const result = compareRows(left, right, sort.key);
      if (result !== 0) return sort.direction === "asc" ? result : -result;
      // Eşitlikte marka adı ikinci anahtar ve HER ZAMAN A→Z: yön çevrilseydi
      // aynı sayıya sahip markalar azalan sıralamada ters alfabetik dizilir,
      // kullanıcı da listeyi gözle takip edemezdi.
      return left.brand_name.localeCompare(right.brand_name, "tr", { sensitivity: "base" });
    });
    return copy;
  }, [rows, sort]);

  function toggle(key: SortKey) {
    setSort((current) => {
      if (current.key !== key) {
        // Sayı sütunlarında ilk tıklama ÇOKTAN AZA: "kimde en çok stok var"
        // sorusu, "kimde en az" sorusundan daha sık soruluyor.
        return { key, direction: key === "brand" ? "asc" : "desc" };
      }
      return { key, direction: current.direction === "asc" ? "desc" : "asc" };
    });
  }

  const totals: Record<ContentKind, { ready: number; target: number }> = {
    Post: { ready: 0, target: 0 },
    Story: { ready: 0, target: 0 },
    Reels: { ready: 0, target: 0 },
  };
  for (const row of rows) {
    for (const kind of CONTENT_KINDS) {
      totals[kind].ready += row.ready[kind];
      totals[kind].target += row.targets[kind];
    }
  }

  function headerCell(key: SortKey, label: string) {
    const active = sort.key === key;
    return (
      <th
        key={key}
        scope="col"
        aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
        className="px-3 py-2 font-medium"
      >
        <button
          type="button"
          onClick={() => toggle(key)}
          className="ui-press inline-flex min-h-8 items-center gap-1 rounded-md px-1 text-[11px] tracking-[0.08em] hover:text-foreground"
        >
          {label}
          <span aria-hidden="true" className={active ? "text-brand-600 dark:text-brand-400" : "text-faint"}>
            {active ? (sort.direction === "asc" ? "▲" : "▼") : "↕"}
          </span>
        </button>
      </th>
    );
  }

  return (
    <section className="overflow-x-auto rounded-xl border border-border-default bg-surface">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border-default text-left text-[11px] tracking-[0.08em] text-muted">
            {headerCell("brand", "Marka")}
            {CONTENT_KINDS.map((kind) => headerCell(kind, CONTENT_KIND_LABEL[kind]))}
            {headerCell("delivery", "Aylık teslim")}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={row.brand_id}
              className="border-b border-border-subtle last:border-0 hover:bg-surface-hover"
            >
              <td className="px-3 py-2">
                <Link
                  href={`/brands/${row.brand_id}`}
                  className="flex min-w-0 items-center gap-2 font-medium hover:text-brand-600 dark:hover:text-brand-400"
                >
                  <BrandLogo name={row.brand_name} logoPath={row.logo_path} size="sm" />
                  <span className="truncate">{row.brand_name}</span>
                </Link>
              </td>
              {CONTENT_KINDS.map((kind) => {
                const target = row.targets[kind];
                const ready = row.ready[kind];
                return (
                  <td key={kind} className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <CountStepper
                        value={ready}
                        onSave={setAssetCountAction.bind(null, row.brand_id, kind)}
                        label={`${row.brand_name} ${CONTENT_KIND_LABEL[kind]} varlığı`}
                      />
                      {target > 0 ? (
                        <span className={`text-xs font-medium tabular-nums ${progressTone(ready, target)}`}>
                          / {target}
                        </span>
                      ) : (
                        <Link
                          href={`/brands/${row.brand_id}`}
                          className="text-xs font-medium text-brand-700 underline decoration-dotted underline-offset-2 hover:text-brand-800 hover:decoration-solid dark:text-brand-300"
                        >
                          / hedef gir
                        </Link>
                      )}
                    </span>
                  </td>
                );
              })}
              <td className="px-3 py-2">
                <Link
                  href={`/brands/${row.brand_id}`}
                  className={row.monthly_content_completed
                    ? "inline-flex rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
                    : "inline-flex rounded-full border border-brand-500/30 bg-brand-500/[0.06] px-2 py-1 text-[10px] font-semibold text-brand-700 hover:border-brand-500/50 hover:bg-brand-500/10 dark:text-brand-300"}
                >
                  {row.monthly_content_completed ? `${monthLabel} teslimi tamamlandı` : `${monthLabel} teslimi açık`}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border-default bg-surface-subtle text-xs font-semibold text-secondary">
            <td className="px-3 py-2">Portföy toplamı</td>
            {CONTENT_KINDS.map((kind) => (
              <td key={kind} className="px-3 py-2 tabular-nums">
                {totals[kind].ready} / {totals[kind].target}
              </td>
            ))}
            <td className="px-3 py-2 text-muted">
              {rows.filter((row) => row.monthly_content_completed).length} / {rows.length} marka kapalı
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  );
}
