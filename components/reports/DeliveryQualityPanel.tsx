import EmptyState from "@/components/EmptyState";
import { TASK_REVISION_REASON_LABEL } from "@/lib/constants";
import type { DeliveryQualityReport } from "@/lib/repositories/reports";
import type { TaskRevisionReason } from "@/lib/types";

function rate(value: number | null): string {
  return value === null ? "Karar yok" : `%${value}`;
}

export default function DeliveryQualityPanel({ report }: { report: DeliveryQualityReport }) {
  if (report.total_deliveries === 0) {
    return (
      <EmptyState
        compact
        title="Henüz teslim verisi yok"
        description="Versiyonlu teslimler kullanılmaya başladığında onay ve revize dağılımı burada görünecek."
      />
    );
  }

  const metrics = [
    { label: "Toplam versiyon", value: report.total_deliveries },
    { label: "Karar bekliyor", value: report.pending_deliveries },
    { label: "Onaylandı", value: report.approved_deliveries },
    { label: "Revize istendi", value: report.revision_requests },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-xl border border-border-subtle bg-surface-subtle px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">{metric.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{metric.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Revize nedenleri</h3>
              <p className="mt-1 text-xs text-muted">Tekrarlayan geri bildirimleri görünür kılar.</p>
            </div>
            <span className="text-xs font-semibold text-secondary">İlk onay {rate(report.approval_rate)}</span>
          </div>
          {report.reasons.length > 0 ? (
            <ol className="mt-3 divide-y divide-border-subtle">
              {report.reasons.map((row) => (
                <li key={row.reason} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-secondary">{TASK_REVISION_REASON_LABEL[row.reason as TaskRevisionReason] ?? row.reason}</span>
                  <span className="font-semibold tabular-nums text-foreground">{row.revision_requests}</span>
                </li>
              ))}
            </ol>
          ) : <p className="mt-3 text-xs text-muted">Bu dönemde revize nedeni kaydedilmedi.</p>}
        </div>

        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Marka bazında teslim kalitesi</h3>
          <p className="mt-1 text-xs text-muted">İlk kararda onay oranı ve revize yükü.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-xs">
              <thead className="text-muted">
                <tr className="border-b border-border-subtle">
                  <th className="pb-2 font-medium">Marka</th>
                  <th className="pb-2 text-right font-medium">Versiyon</th>
                  <th className="pb-2 text-right font-medium">Onay</th>
                  <th className="pb-2 text-right font-medium">Revize</th>
                  <th className="pb-2 text-right font-medium">İlk onay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {report.brands.map((brand) => (
                  <tr key={brand.brand_id}>
                    <td className="max-w-48 truncate py-2.5 font-semibold text-foreground">{brand.brand_name}</td>
                    <td className="py-2.5 text-right tabular-nums text-secondary">{brand.total_deliveries}</td>
                    <td className="py-2.5 text-right tabular-nums text-secondary">{brand.approved_deliveries}</td>
                    <td className="py-2.5 text-right tabular-nums text-secondary">{brand.revision_requests}</td>
                    <td className="py-2.5 text-right font-semibold tabular-nums text-foreground">{rate(brand.approval_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
