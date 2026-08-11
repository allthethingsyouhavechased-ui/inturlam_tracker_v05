import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import Icon from "@/components/ui/Icon";
import type { BrandSocialRow } from "@/lib/types";

export default function SilentAccountsCard({
  silent,
  brokenCount,
  thresholdDays,
  syncBroken,
}: {
  silent: BrandSocialRow[];
  brokenCount: number;
  thresholdDays: number;
  syncBroken: boolean;
}) {
  if (silent.length === 0 && brokenCount === 0 && !syncBroken) return null;

  return (
    <section aria-labelledby="silent-accounts-title" className="overflow-hidden rounded-xl border border-border-default bg-surface">
      <div className="flex flex-col gap-3 border-l-[3px] border-l-danger px-4 py-4 sm:flex-row sm:items-center">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-rose-50 text-danger dark:bg-rose-950/40 dark:text-rose-300">
          <Icon name="alert" className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="silent-accounts-title" className="text-[13px] font-semibold text-foreground">
            {silent.length > 0 ? `${silent.length} sosyal hesap dikkat istiyor` : "Sosyal medya verisi kontrol edilmeli"}
          </h2>
          <p className="mt-0.5 text-[11px] text-muted">
            {silent.length > 0
              ? `${thresholdDays} günden uzun süredir yeni paylaşım görülmeyen hesaplar.`
              : "Takip verisinin bir bölümü güncel olmayabilir."}
          </p>
        </div>
        {silent.length > 0 && (
          <ul className="flex min-w-0 flex-wrap gap-2 sm:max-w-[46%] sm:justify-end">
            {silent.slice(0, 4).map((row) => (
              <li key={row.brand_id}>
                <Link href={`/brands/${row.brand_id}`} className="flex min-h-10 items-center gap-2 rounded-[10px] border border-border-subtle bg-surface-subtle px-2.5 hover:border-border-strong hover:bg-surface-hover">
                  <BrandLogo name={row.brand_name} logoPath={row.logo_path} size="sm" />
                  <span className="max-w-28 truncate text-[11px] font-semibold text-secondary">{row.brand_name}</span>
                  <span className="text-[10px] font-semibold tabular-nums text-danger dark:text-rose-300">{row.days_silent}g</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/social/takip" className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-[9px] px-2 text-[11px] font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950">
          İncele <Icon name="arrow-right" className="size-3.5" />
        </Link>
      </div>
      {(brokenCount > 0 || syncBroken) && (
        <p className="border-t border-border-subtle bg-amber-50/60 px-4 py-2 text-[11px] font-medium text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          {syncBroken
            ? "Son tarama başarısız oldu; bilgi güncel olmayabilir."
            : `${brokenCount} hesap için veri çekilemedi; bu durum paylaşım yapılmadığı anlamına gelmez.`}
        </p>
      )}
    </section>
  );
}
