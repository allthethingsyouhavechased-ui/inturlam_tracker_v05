import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";
import CountStepper from "@/components/CountStepper";
import EmptyState from "@/components/EmptyState";
import { setBrandAssetCountAction } from "@/lib/actions/socialPlan";
import { requirePageSession } from "@/lib/identity";
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

export default async function SocialVarlikPage() {
  await requirePageSession();
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
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-foreground">Hazır içerik varlığı</h2>
        <p className="mt-1 text-xs text-muted">Yayına hazır stok ve marka bazlı aylık hedef karşılaştırması.</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Takip edilecek marka yok"
          description="Aktif bir marka eklendiğinde varlık takibi burada başlar."
        />
      ) : (
        <section className="overflow-x-auto rounded-xl border border-border-default bg-surface">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border-default text-left text-[11px] tracking-[0.08em] text-muted">
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
                  className="border-b border-border-subtle last:border-0 hover:bg-surface-hover"
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
              <tr className="border-t border-border-default bg-surface-subtle text-xs font-semibold text-secondary">
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
