"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import { CONTENT_KINDS, CONTENT_KIND_LABEL } from "@/lib/socialPlan";
import { barPercent, ratioLabel, stockRow, stockTotals } from "@/lib/socialStock";
import type { BrandVarlikRow, ContentKind } from "@/lib/types";

/**
 * Stok / hedef raporu. Ekran ve Excel AYNI saf hesabı (lib/socialStock.ts)
 * kullanır. Toplam eksik, marka eksiklerinin toplamıdır: bir markadaki fazla
 * stok başka markadaki eksiği KAPATMAZ.
 */
export default function SocialStockReport({
  rows,
  lastUpdates,
  monthLabel,
}: {
  rows: BrandVarlikRow[];
  lastUpdates: Record<string, string>;
  monthLabel: string;
}) {
  const [brandId, setBrandId] = useState("");
  const [kind, setKind] = useState<ContentKind | "">("");
  const [onlyMissing, setOnlyMissing] = useState(false);

  // `kinds` her render'da yeni dizi üretmesin diye useMemo'nun İÇİNDE:
  // dışarıda kalsaydı bağımlılık her seferinde değişip memo'yu anlamsız kılardı.
  const computed = useMemo(() => {
    const kinds = kind ? [kind] : CONTENT_KINDS;
    return rows.map((row) => stockRow(row, kinds));
  }, [rows, kind]);
  const filtered = computed.filter((row) => {
    if (brandId && row.brand_id !== brandId) return false;
    if (onlyMissing && row.totalMissing === 0) return false;
    return true;
  });
  const totals = stockTotals(filtered);

  const exportQuery = new URLSearchParams();
  if (brandId) exportQuery.set("brand", brandId);
  if (kind) exportQuery.set("kind", kind);
  if (onlyMissing) exportQuery.set("missing", "1");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border-default bg-surface p-3">
        <label className="grid gap-1.5 text-xs font-medium text-secondary">
          Marka
          <select
            value={brandId}
            onChange={(event) => setBrandId(event.target.value)}
            className="min-h-9 rounded-[9px] border border-border-default bg-surface px-2 text-sm"
          >
            <option value="">Tümü</option>
            {rows.map((row) => <option key={row.brand_id} value={row.brand_id}>{row.brand_name}</option>)}
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-secondary">
          Tür
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as ContentKind | "")}
            className="min-h-9 rounded-[9px] border border-border-default bg-surface px-2 text-sm"
          >
            <option value="">Tümü</option>
            {CONTENT_KINDS.map((value) => (
              <option key={value} value={value}>{CONTENT_KIND_LABEL[value]}</option>
            ))}
          </select>
        </label>
        <label className="flex min-h-9 items-center gap-2 text-xs font-medium text-secondary">
          <input
            type="checkbox"
            checked={onlyMissing}
            onChange={(event) => setOnlyMissing(event.target.checked)}
            className="size-4"
          />
          Yalnız eksikler
        </label>
        <a
          href={`/social/rapor/export?${exportQuery}`}
          className="ml-auto min-h-9 rounded-[9px] border border-border-default bg-surface px-3 text-xs font-semibold leading-9 text-secondary hover:bg-surface-hover"
        >
          Excel indir
        </a>
      </div>

      <section className="overflow-x-auto rounded-xl border border-border-default bg-surface">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border-default text-left text-[11px] tracking-[0.08em] text-muted">
              <th className="px-3 py-2 font-medium">Marka</th>
              <th className="px-3 py-2 font-medium">Tür</th>
              <th className="px-3 py-2 font-medium">Hazır stok</th>
              <th className="px-3 py-2 font-medium">Aylık hedef</th>
              <th className="px-3 py-2 font-medium">Eksik</th>
              <th className="px-3 py-2 font-medium">Fazla</th>
              <th className="px-3 py-2 font-medium">Oran</th>
              <th className="px-3 py-2 font-medium">Aylık teslim</th>
              <th className="px-3 py-2 font-medium">Son stok güncellemesi</th>
            </tr>
          </thead>
          <tbody>
            {filtered.flatMap((row) =>
              row.cells.map((cell, index) => (
                <tr key={`${row.brand_id}-${cell.kind}`} className="border-b border-border-subtle last:border-0">
                  {index === 0 ? (
                    <td className="px-3 py-2" rowSpan={row.cells.length}>
                      <Link href={`/brands/${row.brand_id}`} className="flex min-w-0 items-center gap-2 font-medium hover:text-brand-600 dark:hover:text-brand-400">
                        <BrandLogo name={row.brand_name} logoPath={row.logo_path} size="sm" />
                        <span className="truncate">{row.brand_name}</span>
                      </Link>
                    </td>
                  ) : null}
                  <td className="px-3 py-2 text-xs text-secondary">{CONTENT_KIND_LABEL[cell.kind]}</td>
                  <td className="px-3 py-2 tabular-nums">{cell.ready}</td>
                  <td className="px-3 py-2 tabular-nums">{cell.target > 0 ? cell.target : "—"}</td>
                  <td className={`px-3 py-2 tabular-nums ${cell.missing > 0 ? "font-semibold text-amber-600 dark:text-amber-400" : "text-muted"}`}>
                    {cell.missing}
                  </td>
                  <td className={`px-3 py-2 tabular-nums ${cell.surplus > 0 ? "text-success" : "text-muted"}`}>
                    {cell.surplus}
                  </td>
                  <td className="px-3 py-2">
                    {cell.ratio === null ? (
                      <span className="text-xs text-muted">{ratioLabel(null)}</span>
                    ) : (
                      <span className="flex items-center gap-2">
                        {/* Çubuk %100'de dolar; sayı 100 üstünü göstermeye devam eder. */}
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-muted">
                          <span
                            className={`block h-full ${cell.ratio >= 100 ? "bg-emerald-500" : "bg-amber-500"}`}
                            style={{ width: `${barPercent(cell.ratio)}%` }}
                          />
                        </span>
                        <span className="text-xs tabular-nums text-secondary">{ratioLabel(cell.ratio)}</span>
                      </span>
                    )}
                  </td>
                  {index === 0 ? (
                    <td className="px-3 py-2 text-xs" rowSpan={row.cells.length}>
                      {row.monthly_content_completed ? (
                        <span className="text-success">{monthLabel} tamamlandı</span>
                      ) : (
                        <span className="text-muted">{monthLabel} açık</span>
                      )}
                    </td>
                  ) : null}
                  {index === 0 ? (
                    <td className="px-3 py-2 text-xs text-muted" rowSpan={row.cells.length}>
                      {lastUpdates[row.brand_id] ?? "Hiç girilmedi"}
                    </td>
                  ) : null}
                </tr>
              )),
            )}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-10 text-center text-sm text-muted">
                  Bu filtreyle eşleşen satır yok.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-border-default bg-surface-subtle text-xs font-semibold text-secondary">
              <td className="px-3 py-2" colSpan={2}>Portföy toplamı</td>
              <td className="px-3 py-2 tabular-nums">{totals.ready}</td>
              <td className="px-3 py-2 tabular-nums">{totals.target}</td>
              <td className="px-3 py-2 tabular-nums">{totals.missing}</td>
              <td className="px-3 py-2 tabular-nums">{totals.surplus}</td>
              <td className="px-3 py-2 text-muted" colSpan={3}>
                Toplam eksik, marka eksiklerinin toplamıdır; başka markanın fazlasıyla kapanmaz.
              </td>
            </tr>
          </tfoot>
        </table>
      </section>
    </div>
  );
}
