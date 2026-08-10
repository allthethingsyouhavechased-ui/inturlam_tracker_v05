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
}: {
  brandId: string;
  brandName: string;
  targets: Record<ContentKind, number>;
}) {
  return (
    <section className="space-y-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Aylık içerik hedefleri
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Ay fark etmeksizin geçerli sabit hedef —{" "}
          <Link
            href="/social/varlik"
            className="font-medium text-brand-600 hover:underline dark:text-brand-400"
          >
            Varlık
          </Link>{" "}
          sayfasında bu markanın elindeki hazır sayı bununla karşılaştırılır.
        </p>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-3">
        {CONTENT_KINDS.map((kind) => (
          <label
            key={kind}
            className="grid gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400"
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
