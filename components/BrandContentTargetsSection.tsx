import Link from "next/link";
import CountStepper from "@/components/CountStepper";
import { setBrandContentTargetAction, setBrandMonthlyContentCompletionAction } from "@/lib/actions/socialPlan";
import { CONTENT_KINDS, CONTENT_KIND_LABEL } from "@/lib/socialPlan";
import type { ContentKind } from "@/lib/types";

// Marka sayfasındaki aylık üretim hedefi bölümü — ay fark etmeksizin geçerli
// SABİT hedef (kullanıcı kararı, bkz. plan). `/social/varlik` bu markanın
// elinde ne kadar hazır olduğunu bu hedefle karşılaştırır.
export default function BrandContentTargetsSection({
  brandId,
  brandName,
  targets,
  month,
  monthlyContentCompleted,
  compact = false,
}: {
  brandId: string;
  brandName: string;
  targets: Record<ContentKind, number>;
  month: string;
  monthlyContentCompleted: boolean;
  compact?: boolean;
}) {
  const completionControl = (
    <form
      action={setBrandMonthlyContentCompletionAction.bind(
        null,
        brandId,
        month,
        !monthlyContentCompleted,
      )}
      className={compact ? "shrink-0 self-end" : "mt-3"}
    >
      <button
        type="submit"
        aria-pressed={monthlyContentCompleted}
        aria-label="Aylık içerikler tamamlandı"
        className={monthlyContentCompleted
          ? "ui-press inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-emerald-700/30 bg-emerald-500/10 px-2.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-300"
          : "ui-press inline-flex min-h-8 items-center justify-center rounded-lg border border-brand-500/30 bg-brand-500/[0.06] px-2.5 text-[10px] font-semibold text-brand-700 hover:border-brand-500/50 hover:bg-brand-500/10 dark:text-brand-300"}
        title={monthlyContentCompleted ? "Teslim işaretini geri al" : "Canlı stoktan bağımsız olarak bu ayın teslimini kapat"}
      >
        {monthlyContentCompleted
          ? compact ? "✓ Tamamlandı" : "✓ Aylık içerikler tamamlandı"
          : compact ? "Tamamlandı" : "Aylık içerikler tamamlandı"}
      </button>
    </form>
  );

  // Compact hâl marka sayfasının üst şeridinde, sol başlık ile ay gezgininin
  // ARASINDA duruyor: kendi içinde ortalanmak yerine kalan genişliği kaplıyor
  // (`flex-1`), sayaçlar da o genişliğe eşit dağılıyor. "AYLIK HEDEF" başlığı
  // `self-start` ile POST/STORY/REELS etiketleriyle aynı satırda.
  return (
    <section className={compact ? "flex min-w-0 flex-1 items-end justify-between gap-x-4 gap-y-2 overflow-x-auto pb-1" : "space-y-3 rounded-xl border border-border-default bg-surface p-4"}>
      <div className={compact ? "shrink-0 self-start" : undefined}>
        <h2 className={compact ? "text-eyebrow text-brand-600 dark:text-brand-300" : "text-sm font-semibold text-foreground"}>
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
      <div
        data-compact-target-grid={compact || undefined}
        className={compact ? "flex min-w-0 flex-1 flex-nowrap items-end justify-evenly gap-3" : "flex flex-wrap gap-x-6 gap-y-3"}
      >
        {CONTENT_KINDS.map((kind) => (
          <label
            key={kind}
            className={compact ? "grid shrink-0 gap-1 text-center text-[9px] font-medium uppercase tracking-wide text-muted" : "grid gap-1 text-xs font-medium text-muted"}
          >
            {CONTENT_KIND_LABEL[kind]}
            <CountStepper
              value={targets[kind]}
              onSave={setBrandContentTargetAction.bind(null, brandId, kind)}
              label={`${brandName} aylık ${CONTENT_KIND_LABEL[kind]} hedefi`}
            />
          </label>
        ))}
        {compact && completionControl}
      </div>
      {!compact && completionControl}
    </section>
  );
}
