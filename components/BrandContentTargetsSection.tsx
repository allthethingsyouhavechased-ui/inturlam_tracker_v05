import Link from "next/link";
import CountStepper from "@/components/CountStepper";
import { setBrandContentTargetAction } from "@/lib/actions/socialPlan";
import { CONTENT_KINDS, CONTENT_KIND_LABEL } from "@/lib/socialPlan";
import type { ContentKind } from "@/lib/types";

// Marka sayfasındaki aylık üretim hedefi bölümü — ay fark etmeksizin geçerli
// SABİT hedef (kullanıcı kararı, bkz. plan). `/social/varlik` bu markanın
// elinde ne kadar hazır olduğunu bu hedefle karşılaştırır.
export default function BrandContentTargetsSection({
  brandId,
  brandName,
  targets,
  compact = false,
}: {
  brandId: string;
  brandName: string;
  targets: Record<ContentKind, number>;
  compact?: boolean;
}) {
  return (
    <section className={compact ? "min-w-0" : "space-y-3 rounded-xl border border-border-default bg-surface p-4"}>
      <div>
        <h2 className={compact ? "text-[9px] font-semibold tracking-[0.08em] text-faint" : "text-sm font-semibold text-foreground"}>
          {compact ? "AYLIK HEDEF" : "Aylık içerik hedefleri"}
        </h2>
        {!compact && <p className="mt-0.5 text-xs text-muted">
          Ay fark etmeksizin geçerli sabit hedef —{" "}
          <Link
            href="/social/varlik"
            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Varlık
          </Link>{" "}
          sayfasında bu markanın elindeki hazır sayı bununla karşılaştırılır.
        </p>}
      </div>
      <div className={compact ? "mt-2 flex flex-wrap gap-x-3 gap-y-2" : "flex flex-wrap gap-x-6 gap-y-3"}>
        {CONTENT_KINDS.map((kind) => (
          <label
            key={kind}
            className={compact ? "grid gap-1 text-[9px] font-medium uppercase tracking-wide text-muted" : "grid gap-1 text-xs font-medium text-muted"}
          >
            {CONTENT_KIND_LABEL[kind]}
            <CountStepper
              value={targets[kind]}
              onSave={setBrandContentTargetAction.bind(null, brandId, kind)}
              label={`${brandName} aylık ${CONTENT_KIND_LABEL[kind]} hedefi`}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
