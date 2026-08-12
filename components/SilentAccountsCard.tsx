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
      <div className="grid gap-4 border-l-[3px] border-l-danger px-4 py-4 lg:grid-cols-[minmax(14rem,0.8fr)_minmax(0,1.65fr)_auto] lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-rose-50 text-danger dark:bg-rose-950/40 dark:text-rose-300">
            <Icon name="alert" className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <h2 id="silent-accounts-title" className="text-[13px] font-semibold text-foreground">
              {silent.length > 0 ? `${silent.length} sosyal hesap dikkat istiyor` : "Sosyal medya verisi kontrol edilmeli"}
            </h2>
            <p className="mt-0.5 text-[11px] text-muted">
              {silent.length > 0
                ? `${thresholdDays} günden uzun süredir yeni paylaşım görülmeyen hesaplar.`
                : "Takip verisinin bir bölümü güncel olmayabilir."}
            </p>
          </div>
        </div>
        {silent.length > 0 && (
          <ul className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {silent.slice(0, 4).map((row) => (
              <li key={row.brand_id} className="min-w-0">
                <Link href={`/brands/${row.brand_id}`} className="flex min-h-10 min-w-0 items-center gap-2 rounded-[10px] border border-border-subtle bg-surface-subtle px-2.5 hover:border-border-strong hover:bg-surface-hover">
                  <BrandLogo name={row.brand_name} logoPath={row.logo_path} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-secondary">{row.brand_name}</span>
                  <span className="shrink-0 text-[10px] font-semibold tabular-nums text-danger dark:text-rose-300">{row.days_silent}g</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Link href="/social/takip" className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1 rounded-[9px] px-2 text-[11px] font-semibold text-brand-600 hover:bg-brand-50 lg:justify-self-end dark:text-brand-300 dark:hover:bg-brand-950">
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
