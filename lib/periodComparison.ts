export function comparePeriod(current: number, previous: number | null | undefined): string {
  if (previous == null) return "Önceki dönemde plan yok";
  const difference = Number((current - previous).toFixed(1));
  if (difference === 0) return "Önceki dönemle aynı";
  return `Önceki döneme göre ${difference > 0 ? "+" : ""}${difference}`;
}
