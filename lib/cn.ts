// Küçük, bağımlılıksız className birleştirici — clsx/tailwind-merge yerine.
// Çakışan Tailwind class'larını BİRLEŞTİRMEZ (tailwind-merge'in yaptığı gibi),
// sadece boş/false/null/undefined değerleri eleyip birleştirir.
// components/ui/* bunun ötesine ihtiyaç duymuyor; ayrı bir paket eklemeye
// değmedi (projenin geri kalanı da bağımlılıksız araçları tercih ediyor,
// bkz. lib/xlsx.ts).
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
