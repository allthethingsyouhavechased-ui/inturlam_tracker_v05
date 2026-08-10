import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import type { BrandSocialRow } from "@/lib/types";

// Panom'daki "sessiz hesaplar" özeti. Hiç sessiz hesap yoksa HİÇ çizilmez —
// her gün bakılan bir sayfada "her şey yolunda" kutusu yer kaplamasın diye.
// Taramanın kendisi bozuksa ayrı bir uyarı çıkar: boş liste "sorun yok"
// anlamına gelmesin.
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
    <section
      aria-labelledby="silent-accounts-title"
      className={`rounded-2xl border p-4 ${
        silent.length > 0
          ? "border-rose-200 bg-rose-50/60 dark:border-rose-900/70 dark:bg-rose-950/20"
          : "border-amber-200 bg-amber-50/60 dark:border-amber-900/70 dark:bg-amber-950/20"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="silent-accounts-title"
          className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
        >
          {silent.length > 0
            ? `Sessiz Instagram hesapları (${silent.length})`
            : "Sosyal medya takibi"}
        </h2>
        <Link
          href="/social/takip"
          className="ui-press inline-flex min-h-9 items-center rounded-lg px-2 text-xs font-semibold text-brand-600 hover:bg-white/60 dark:text-brand-400 dark:hover:bg-white/10"
        >
          Tümünü gör →
        </Link>
      </div>

      {silent.length > 0 && (
        <>
          <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300">
            {thresholdDays} günden uzun süredir yeni paylaşım görülmedi.
          </p>
          <ul className="mt-2.5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {silent.map((row) => (
              <li
                key={row.brand_id}
                className="flex min-w-0 items-center gap-2.5 rounded-xl border border-black/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-zinc-900"
              >
                <BrandLogo name={row.brand_name} logoPath={row.logo_path} size="sm" />
                <Link
                  href={`/brands/${row.brand_id}`}
                  className="min-w-0 flex-1 truncate text-sm font-medium hover:text-brand-600 dark:hover:text-brand-400"
                >
                  {row.brand_name}
                </Link>
                <span className="shrink-0 text-sm font-bold tabular-nums text-rose-600 dark:text-rose-400">
                  {row.days_silent}
                  <span className="ml-0.5 text-[10px] font-medium">gün</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {(brokenCount > 0 || syncBroken) && (
        <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">
          {syncBroken
            ? "Son tarama başarısız oldu — buradaki bilgi güncel olmayabilir."
            : `${brokenCount} hesap için veri çekilemedi; “paylaşım yok” anlamına gelmez.`}
        </p>
      )}
    </section>
  );
}
