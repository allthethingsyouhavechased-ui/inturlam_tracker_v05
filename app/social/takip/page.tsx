import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import BrandLogo from "@/components/BrandLogo";
import EmptyState from "@/components/EmptyState";
import SocialHealthBadge from "@/components/SocialHealthBadge";
import { formatDateShort, formatIsoDateTime, formatDateTime, todayISO } from "@/lib/date";
import { SOCIAL_SILENCE_DAYS } from "@/lib/social";
import {
  getLatestSyncRun,
  listBrandSocialRows,
  listRecentSyncRuns,
} from "@/lib/repositories/social";
import { classifySocial, type SocialHealth } from "@/lib/socialSilence";

export const dynamic = "force-dynamic";

const HEALTH_ORDER: SocialHealth[] = ["silent", "error", "unknown", "never-checked", "ok"];

export default async function SocialTakipPage() {
  const today = todayISO();
  const rows = listBrandSocialRows();
  const latestRun = getLatestSyncRun();
  const runs = listRecentSyncRuns(5);

  const withHealth = rows
    .map((row) => ({ row, health: classifySocial(row, SOCIAL_SILENCE_DAYS, today) }))
    .sort(
      (a, b) =>
        HEALTH_ORDER.indexOf(a.health) - HEALTH_ORDER.indexOf(b.health) ||
        (b.row.days_silent ?? -1) - (a.row.days_silent ?? -1) ||
        a.row.brand_name.localeCompare(b.row.brand_name, "tr"),
    );

  const silent = withHealth.filter((item) => item.health === "silent");
  const broken = withHealth.filter(
    (item) => item.health === "error" || item.health === "unknown",
  );
  const neverChecked = withHealth.filter((item) => item.health === "never-checked");

  return (
    <div className="space-y-6">
      <AutoRefresh />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sosyal medya takibi</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Markaların Instagram hesapları düzenli taranır; {SOCIAL_SILENCE_DAYS} günden uzun
            süredir paylaşım yapmayan hesaplar burada ve bildirimlerde işaretlenir.
          </p>
        </div>
        {/* Verinin ne kadar taze olduğu HER ZAMAN görünür olmalı: tarama
            duruyorsa ekrandaki "aktif" rozetleri de bayattır. */}
        <div className="rounded-xl border border-black/10 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-zinc-900">
          {latestRun ? (
            <>
              <div className="font-medium">
                Son tarama:{" "}
                <span className="tabular-nums">{formatDateTime(latestRun.started_at)}</span>
              </div>
              <div
                className={
                  latestRun.status === "error"
                    ? "text-rose-600 dark:text-rose-400"
                    : "text-zinc-500 dark:text-zinc-400"
                }
              >
                {latestRun.status === "error"
                  ? `Hata: ${latestRun.error ?? "bilinmiyor"}`
                  : latestRun.status === "running"
                    ? "Sürüyor…"
                    : `${latestRun.accounts} hesap · ${latestRun.new_posts} yeni gönderi`}
              </div>
            </>
          ) : (
            <span className="text-zinc-500 dark:text-zinc-400">
              Henüz tarama yapılmadı — <code className="font-mono">npm run social:sync</code>
            </span>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Takip edilecek hesap yok"
          description="Marka sayfalarındaki “Instagram kullanıcı adı” alanı doldurulduğunda hesaplar burada listelenir."
        />
      ) : (
        <>
          {silent.length > 0 && (
            <section className="space-y-2 rounded-2xl border border-rose-200 bg-rose-50/60 p-4 dark:border-rose-900/70 dark:bg-rose-950/20">
              <h2 className="text-sm font-semibold text-rose-700 dark:text-rose-300">
                Sessiz hesaplar ({silent.length})
              </h2>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {silent.map(({ row }) => (
                  <li
                    key={row.brand_id}
                    className="flex min-w-0 items-center gap-2.5 rounded-xl border border-black/10 bg-white px-3 py-2 dark:border-white/10 dark:bg-zinc-900"
                  >
                    <BrandLogo name={row.brand_name} logoPath={row.logo_path} size="sm" />
                    <span className="min-w-0 flex-1">
                      <Link
                        href={`/brands/${row.brand_id}`}
                        className="block truncate text-sm font-semibold hover:text-brand-600 dark:hover:text-brand-400"
                      >
                        {row.brand_name}
                      </Link>
                      <span className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                        son paylaşım {formatDateShort(row.last_post_at?.slice(0, 10) ?? null)}
                      </span>
                    </span>
                    <span className="shrink-0 text-lg font-bold tabular-nums text-rose-600 dark:text-rose-400">
                      {row.days_silent}
                      <span className="ml-0.5 text-[10px] font-medium">gün</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(broken.length > 0 || neverChecked.length > 0) && (
            <section className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/70 dark:bg-amber-950/20">
              <h2 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Veri gelmeyen hesaplar ({broken.length + neverChecked.length})
              </h2>
              <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                Bunlar “paylaşım yapmıyor” demek DEĞİL — tarama bu hesaplar için sonuç
                döndüremedi. Hesap özel/kapalı olabilir, kullanıcı adı değişmiş olabilir ya da
                sağlayıcı hata vermiş olabilir.
              </p>
              <ul className="space-y-1">
                {[...broken, ...neverChecked].map(({ row, health }) => (
                  <li
                    key={row.brand_id}
                    className="flex flex-wrap items-center gap-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-xs dark:bg-zinc-900/70"
                  >
                    <span className="font-medium">{row.brand_name}</span>
                    <span className="text-zinc-500 dark:text-zinc-400">@{row.handle}</span>
                    <SocialHealthBadge health={health} />
                    {row.last_error && (
                      <span className="min-w-0 flex-1 truncate text-zinc-500 dark:text-zinc-400">
                        {row.last_error}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="overflow-x-auto rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wider text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                  <th className="px-3 py-2 font-medium">Marka</th>
                  <th className="px-3 py-2 font-medium">Hesap</th>
                  <th className="px-3 py-2 font-medium">Durum</th>
                  <th className="px-3 py-2 font-medium">Son paylaşım</th>
                  <th className="px-3 py-2 font-medium">Son 30 gün</th>
                  <th className="px-3 py-2 font-medium">Son kontrol</th>
                </tr>
              </thead>
              <tbody>
                {withHealth.map(({ row, health }) => (
                  <tr
                    key={row.brand_id}
                    className="border-b border-black/5 last:border-0 dark:border-white/5"
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
                    <td className="px-3 py-2">
                      <a
                        href={`https://www.instagram.com/${row.handle}/`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-zinc-500 hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-400"
                      >
                        @{row.handle}
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <SocialHealthBadge
                        health={health}
                        detail={
                          health === "silent" || health === "ok"
                            ? `${row.days_silent} gün`
                            : undefined
                        }
                      />
                    </td>
                    <td className="px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-300">
                      {row.last_post_at ? (
                        row.last_post_permalink ? (
                          <a
                            href={row.last_post_permalink}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="hover:text-brand-600 dark:hover:text-brand-400"
                          >
                            {formatIsoDateTime(row.last_post_at)}
                          </a>
                        ) : (
                          formatIsoDateTime(row.last_post_at)
                        )
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{row.post_count_30d}</td>
                    <td className="px-3 py-2 tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatIsoDateTime(row.last_checked_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      )}

      {runs.length > 0 && (
        <section className="space-y-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Son taramalar
          </h2>
          <ul className="space-y-1 text-xs">
            {runs.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-black/[0.07] px-2.5 py-1.5 dark:border-white/10"
              >
                <span className="tabular-nums text-zinc-500 dark:text-zinc-400">
                  {formatDateTime(run.started_at)}
                </span>
                <span
                  className={`font-semibold ${
                    run.status === "error"
                      ? "text-rose-600 dark:text-rose-400"
                      : run.status === "ok"
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-zinc-500 dark:text-zinc-400"
                  }`}
                >
                  {run.status === "ok" ? "Başarılı" : run.status === "error" ? "Hata" : "Sürüyor"}
                </span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {run.accounts} hesap · {run.new_posts} yeni
                </span>
                <span className="text-zinc-400 dark:text-zinc-500">{run.provider}</span>
                {run.error && (
                  <span className="min-w-0 flex-1 truncate text-rose-600 dark:text-rose-400">
                    {run.error}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
