// Sosyal stok/hedef raporunun SAF hesabı. Ekran ve Excel AYNI fonksiyonu
// çağırıyor: iki yerde ayrı ayrı hesaplanırsa biri diğerinden kayar ve
// "Excel başka söylüyor" şikâyeti doğar.
import { CONTENT_KINDS } from "@/lib/socialPlan";
import type { BrandVarlikRow, ContentKind } from "@/lib/types";

export interface StockCell {
  kind: ContentKind;
  ready: number;
  target: number;
  /** max(hedef - stok, 0) */
  missing: number;
  /** max(stok - hedef, 0) */
  surplus: number;
  /** Hedef yoksa null — "0 yüzde" ile "hedef tanımlı değil" ayrı şeyler. */
  ratio: number | null;
}

export interface StockRow {
  brand_id: string;
  brand_name: string;
  logo_path: string | null;
  cells: StockCell[];
  monthly_content_completed: boolean;
  monthly_content_completed_at: string | null;
  totalMissing: number;
  totalSurplus: number;
}

export function stockCell(kind: ContentKind, ready: number, target: number): StockCell {
  return {
    kind,
    ready,
    target,
    missing: Math.max(target - ready, 0),
    surplus: Math.max(ready - target, 0),
    // Hedef 0/negatifse oran ANLAMSIZ: sıfıra bölme yerine "tanımlı değil".
    ratio: target > 0 ? Math.round((ready / target) * 100) : null,
  };
}

export function stockRow(row: BrandVarlikRow, kinds: readonly ContentKind[] = CONTENT_KINDS): StockRow {
  const cells = kinds.map((kind) => stockCell(kind, row.ready[kind] ?? 0, row.targets[kind] ?? 0));
  return {
    brand_id: row.brand_id,
    brand_name: row.brand_name,
    logo_path: row.logo_path,
    cells,
    monthly_content_completed: row.monthly_content_completed,
    monthly_content_completed_at: row.monthly_content_completed_at,
    totalMissing: cells.reduce((sum, cell) => sum + cell.missing, 0),
    totalSurplus: cells.reduce((sum, cell) => sum + cell.surplus, 0),
  };
}

export interface StockTotals {
  ready: number;
  target: number;
  /** Marka eksiklerinin TOPLAMI — başka markanın fazlasıyla KAPANMAZ. */
  missing: number;
  surplus: number;
}

/**
 * Portföy toplamı. Kritik kural: toplam eksik, `max(toplam hedef - toplam stok, 0)`
 * DEĞİLDİR. Bir markadaki fazla stok, başka markadaki eksiği kapatmaz —
 * içerik markaya özgüdür, taşınamaz.
 */
export function stockTotals(rows: StockRow[], kind?: ContentKind): StockTotals {
  const totals: StockTotals = { ready: 0, target: 0, missing: 0, surplus: 0 };
  for (const row of rows) {
    for (const cell of row.cells) {
      if (kind && cell.kind !== kind) continue;
      totals.ready += cell.ready;
      totals.target += cell.target;
      totals.missing += cell.missing;
      totals.surplus += cell.surplus;
    }
  }
  return totals;
}

/** Grafik çubuğu %100'de DOLAR; sayısal oran 100 üstünü göstermeye devam eder. */
export function barPercent(ratio: number | null): number {
  if (ratio === null) return 0;
  return Math.max(0, Math.min(100, ratio));
}

export const NO_TARGET_LABEL = "Hedef tanımlı değil";

export function ratioLabel(ratio: number | null): string {
  return ratio === null ? NO_TARGET_LABEL : `%${ratio}`;
}
