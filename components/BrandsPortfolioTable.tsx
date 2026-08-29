"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ArchiveBrandButton from "@/components/ArchiveBrandButton";
import BrandLogo from "@/components/BrandLogo";
import EmptyState from "@/components/EmptyState";
import SocialHealthBadge from "@/components/SocialHealthBadge";
import Icon from "@/components/ui/Icon";
import Input from "@/components/ui/Input";
import {
  filterAndSortBrandPortfolio,
  type BrandPortfolioRow,
  type BrandPortfolioSort,
  type BrandPortfolioSortKey,
} from "@/lib/brandPortfolio";
import { formatPoints } from "@/lib/progress";

const COLUMN_LABEL: Record<BrandPortfolioSortKey, string> = {
  name: "Marka",
  cluster: "Kategori",
  progress: "Aylık %",
  open: "Açık iş",
  social: "Sosyal durum",
  responsible: "Sorumlu",
};

function SortButton({ column, sort, onChange }: { column: BrandPortfolioSortKey; sort: BrandPortfolioSort | null; onChange: (key: BrandPortfolioSortKey) => void }) {
  const active = sort?.key === column;
  return (
    <button type="button" onClick={() => onChange(column)} className={`inline-flex items-center gap-1 text-left hover:text-foreground ${active ? "text-brand-600 dark:text-brand-300" : ""}`}>
      {COLUMN_LABEL[column]}
      <span aria-hidden className={active ? "opacity-100" : "opacity-30"}>{active && sort.direction === "desc" ? "↓" : "↑"}</span>
    </button>
  );
}

export default function BrandsPortfolioTable({ rows, canManageBrands }: { rows: BrandPortfolioRow[]; canManageBrands: boolean }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<BrandPortfolioSort | null>(null);
  const visible = useMemo(
    () => filterAndSortBrandPortfolio(rows, query, null, sort),
    [query, rows, sort],
  );

  function toggleSort(key: BrandPortfolioSortKey) {
    setSort((current) => current?.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: "asc" });
  }

  return (
    <section aria-labelledby="brand-portfolio-table-title" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="brand-portfolio-table-title" className="mr-auto text-sm font-semibold text-foreground">Aktif portföy</h2>
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Markalarda ara</span>
          <Icon name="search" className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Marka, kategori veya sorumlu ara…" className="min-h-9 py-1 pl-8 text-xs md:min-h-9" />
        </label>
        {query && <button type="button" onClick={() => setQuery("")} className="ui-press min-h-9 rounded-md px-2.5 text-xs font-medium text-muted hover:bg-surface-hover hover:text-foreground">Temizle</button>}
      </div>

      {visible.length === 0 ? (
        <EmptyState compact title="Eşleşen marka yok" description="Arama alanını temizleyip yeniden dene." />
      ) : (
        <>
          <div className="grid gap-2 md:hidden">
            {visible.map((row) => (
              <article key={row.id} className="rounded-xl border border-border-default bg-surface p-3">
                <div className="flex items-start gap-3">
                  <BrandLogo name={row.name} logoPath={row.logoPath} accentHue={row.accentHue} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/brands/${row.id}`} className="brand-name block truncate text-sm font-semibold text-foreground hover:text-brand-600">{row.name}</Link>
                    <p className="mt-0.5 text-xs text-muted">{row.clusterLabel}</p>
                  </div>
                  {canManageBrands && <ArchiveBrandButton brandId={row.id} />}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div><dt className="text-muted">Aylık</dt><dd className="font-semibold text-foreground">{row.progressPercent === null ? "Plan yok" : `%${row.progressPercent} · ${formatPoints(row.weightedEarned)}/${formatPoints(row.weightedTotal)}`}</dd></div>
                  <div><dt className="text-muted">Açık iş</dt><dd className="font-semibold text-foreground">{row.openCount}</dd></div>
                  <div><dt className="text-muted">Sosyal</dt><dd>{row.instagramUrl && row.instagramHandle ? <a href={row.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label={`${row.name} Instagram hesabını aç`} className="inline-flex items-center gap-1"><SocialHealthBadge health={row.socialHealth ?? "never-checked"} detail={row.socialDetail ?? undefined} /><span className="sr-only">@{row.instagramHandle}</span></a> : "Hesap yok"}</dd></div>
                  <div><dt className="text-muted">Sorumlu</dt><dd className="truncate font-medium text-secondary">{row.responsibleNames.join(", ") || "Atanmadı"}</dd></div>
                </dl>
              </article>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-border-default bg-surface md:block">
            <table className="w-full min-w-[60rem] text-left text-xs">
              <thead className="border-b border-border-subtle bg-surface-subtle text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">
                <tr>{(["name", "cluster", "progress", "open", "social", "responsible"] as const).map((column) => <th key={column} className="px-3 py-2.5"><SortButton column={column} sort={sort} onChange={toggleSort} /></th>)}{canManageBrands && <th className="w-24 px-3 py-2.5 text-right">İşlem</th>}</tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {visible.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-hover">
                    <td className="px-3 py-3"><span className="flex min-w-0 items-center gap-2.5"><BrandLogo name={row.name} logoPath={row.logoPath} accentHue={row.accentHue} /><Link href={`/brands/${row.id}`} className="brand-name truncate font-semibold text-foreground hover:text-brand-600 dark:hover:text-brand-300">{row.name}</Link></span></td>
                    <td className="px-3 py-3 text-secondary">{row.clusterLabel}</td>
                    <td className="px-3 py-3"><span className="font-semibold tabular-nums text-foreground">{row.progressPercent === null ? "Plan yok" : `%${row.progressPercent}`}</span>{row.progressPercent !== null && <span className="ml-1 text-[10px] tabular-nums text-muted">{formatPoints(row.weightedEarned)}/{formatPoints(row.weightedTotal)} puan</span>}</td>
                    <td className="px-3 py-3 font-semibold tabular-nums text-foreground">{row.openCount}</td>
                    <td className="px-3 py-3">{row.instagramUrl && row.instagramHandle ? <a href={row.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label={`${row.name} Instagram hesabını aç`} className="inline-flex items-center gap-1.5"><SocialHealthBadge health={row.socialHealth ?? "never-checked"} detail={row.socialDetail ?? undefined} /><span className="max-w-28 truncate text-[10px] text-muted">@{row.instagramHandle}</span></a> : <span className="text-muted">Hesap yok</span>}</td>
                    <td className="max-w-52 px-3 py-3 text-secondary"><span className="block truncate" title={row.responsibleNames.join(", ")}>{row.responsibleNames.join(", ") || "Atanmadı"}</span></td>
                    {canManageBrands && <td className="px-3 py-3 text-right"><ArchiveBrandButton brandId={row.id} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
