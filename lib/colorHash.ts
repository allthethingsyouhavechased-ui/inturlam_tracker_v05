// İsim/başlık gibi bir string'e göre sabit bir renk seçer — aynı kişi veya
// aynı içerik her yerde aynı renkte görünür. PersonAvatar ve içerik/proje
// etiketleri (TaskGridCard) bu paleti paylaşır.
// `indigo-*` bilerek YOK — CLAUDE.md aksan rengi kuralı yalnız `brand-*`'e
// izin veriyor, indigo ona en yakın/karışan ton olduğu için palet dışı
// bırakıldı (2026-08-11 tasarım revizyonu).
const PALETTE = [
  "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
];

export function hashColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
