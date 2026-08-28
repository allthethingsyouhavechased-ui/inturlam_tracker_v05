import { SOCIAL_HEALTH_LABEL, type SocialHealth } from "@/lib/socialSilence";

// "Sessiz" ile "veri gelmiyor" AYNI renkte olmamalı: biri markanın sorunu,
// diğeri bizim entegrasyonumuzun sorunu. Karıştırılırsa ekip yanlış yeri
// düzeltmeye çalışır.
const TONE: Record<SocialHealth, string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
  silent:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
  unknown:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  error:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  "never-checked":
    "border-black/10 bg-black/5 text-zinc-600 dark:border-white/15 dark:bg-white/10 dark:text-zinc-300",
};

export default function SocialHealthBadge({
  health,
  detail,
}: {
  health: SocialHealth;
  /** Rozetin sağındaki kısa açıklama (ör. "9 gün"). */
  detail?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-semibold ${TONE[health]}`}
    >
      {SOCIAL_HEALTH_LABEL[health]}
      {detail && <span className="font-normal tabular-nums opacity-80">{detail}</span>}
    </span>
  );
}
