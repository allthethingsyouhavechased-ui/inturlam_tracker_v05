import type { SocialHealth } from "@/lib/socialSilence";

export type BrandPortfolioSortKey = "name" | "cluster" | "progress" | "open" | "social" | "responsible";
export type BrandPortfolioSort = { key: BrandPortfolioSortKey; direction: "asc" | "desc" };

export interface BrandPortfolioRow {
  id: string;
  name: string;
  logoPath: string | null;
  accentHue: number;
  sortOrder: number;
  clusterLabel: string;
  progressPercent: number | null;
  weightedEarned: number;
  weightedTotal: number;
  openCount: number;
  socialHealth: SocialHealth | null;
  socialDetail: string | null;
  instagramHandle: string | null;
  instagramUrl: string | null;
  responsibleNames: string[];
}

const collator = new Intl.Collator("tr", { sensitivity: "base", numeric: true });
const socialRank: Record<SocialHealth, number> = {
  ok: 0,
  silent: 1,
  unknown: 2,
  error: 3,
  "never-checked": 4,
};

function compareRows(left: BrandPortfolioRow, right: BrandPortfolioRow, key: BrandPortfolioSortKey): number {
  if (key === "name") return collator.compare(left.name, right.name);
  if (key === "cluster") return collator.compare(left.clusterLabel, right.clusterLabel);
  if (key === "progress") return (left.progressPercent ?? -1) - (right.progressPercent ?? -1);
  if (key === "open") return left.openCount - right.openCount;
  if (key === "social") {
    return (left.socialHealth ? socialRank[left.socialHealth] : 5) - (right.socialHealth ? socialRank[right.socialHealth] : 5);
  }
  return collator.compare(left.responsibleNames.join(" "), right.responsibleNames.join(" "));
}

export function filterAndSortBrandPortfolio(
  rows: readonly BrandPortfolioRow[],
  query: string,
  selectedBrandId: string | null,
  sort: BrandPortfolioSort | null,
): BrandPortfolioRow[] {
  const needle = query.trim().toLocaleLowerCase("tr-TR");
  const filtered = rows.filter((row) => {
    if (selectedBrandId && row.id !== selectedBrandId) return false;
    if (!needle) return true;
    return [row.name, row.clusterLabel, ...row.responsibleNames]
      .join(" ")
      .toLocaleLowerCase("tr-TR")
      .includes(needle);
  });
  if (!sort) return [...filtered].sort((left, right) => collator.compare(left.name, right.name));
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...filtered].sort((left, right) => direction * compareRows(left, right, sort.key) || left.sortOrder - right.sortOrder);
}
