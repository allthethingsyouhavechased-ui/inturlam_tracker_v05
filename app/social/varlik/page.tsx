import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import CountStepper from "@/components/CountStepper";
import EmptyState from "@/components/EmptyState";
import { setBrandAssetCountAction } from "@/lib/actions/socialPlan";
import { listBrandVarlikRows } from "@/lib/repositories/socialPlan";
import { CONTENT_KINDS, CONTENT_KIND_LABEL } from "@/lib/socialPlan";
import type { ContentKind } from "@/lib/types";

export const dynamic = "force-dynamic";

// Hedefe göre renk: hedef hiç girilmemişse (0) nötr, hedefe ulaşıldıysa
// yeşil, altındaysa amber. `ready === 0` ayrıca soluklaştırılır — "hiç
// üretilmemiş" ile "biraz üretilmiş ama yetmiyor" görsel olarak ayrılsın.
function progressTone(ready: number, target: number): string {
  if (target <= 0) return "text-zinc-400 dark:text-zinc-500";
  if (ready >= target) return "text-emerald-600 dark:text-emerald-400";
  if (ready === 0) return "text-zinc-500 dark:text-zinc-400";
  return "text-amber-600 dark:text-amber-400";
}

export default function SocialVarlikPage() {
  const rows = listBrandVarlikRows();

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Varlık</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Elde yayına hazır bekleyen içerik sayısı — güncel stok: paylaşınca azalt,
          üretince artır. Aylık hedefler her markanın kendi sayfasından girilir.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Takip edilecek marka yok"
          description="Aktif bir marka eklendiğinde varlık takibi burada başlar."
        />
      ) : (
        <section className="overflow-x-auto rounded-xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-black/10 text-left text-xs uppercase tracking-wider text-zinc-500 dark:border-white/10 dark:text-zinc-400">
                <th className="px-3 py-2 font-medium">Marka</th>
                {CONTENT_KINDS.map((kind) => (
                  <th key={kind} className="px-3 py-2 font-medium">
                    {CONTENT_KIND_LABEL[kind]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
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
                  {CONTENT_KINDS.map((kind) => {
                    const target = row.targets[kind];
                    const ready = row.ready[kind];
                    return (
                      <td key={kind} className="px-3 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <CountStepper
                            value={ready}
                            onSave={setBrandAssetCountAction.bind(null, row.brand_id, kind)}
                            label={`${row.brand_name} ${CONTENT_KIND_LABEL[kind]} varlığı`}
                          />
                          {target > 0 ? (
                            <span
                              className={`text-xs font-medium tabular-nums ${progressTone(ready, target)}`}
                            >
                              / {target}
                            </span>
                          ) : (
                            <Link
                              href={`/brands/${row.brand_id}`}
                              className="text-xs font-medium text-zinc-400 underline decoration-dotted underline-offset-2 hover:decoration-solid dark:text-zinc-500"
                            >
                              / hedef gir
                            </Link>
                          )}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-black/10 bg-zinc-50 text-xs font-semibold text-zinc-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-200">
                <td className="px-3 py-2">Portföy toplamı</td>
                {CONTENT_KINDS.map((kind) => (
                  <td key={kind} className="px-3 py-2 tabular-nums">
                    {totals[kind].ready} / {totals[kind].target}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </section>
      )}
    </div>
  );
}
