// Aylık toplu görev üretiminin SAF kuralları. Hem önizleme (istemci) hem
// otomasyon (sunucu) aynı yerden okuyor; ikisinin ayrı yorumlaması "elle
// ürettiğim paket otomatikten farklı çıkıyor" şikâyetini doğururdu.

/** Varsayılan adet. Değiştirilebilir — katalog kalemi farklı adet isteyebilir. */
export const DEFAULT_MONTHLY_COUNT = 4;

/** Üretim günü varsayılanı: ayın 1'i. Plan ayarından değiştirilebilir. */
export const DEFAULT_GENERATION_DAY = 1;

const MONTH_RE = /^\d{4}-\d{2}$/;

export function isValidPlanMonth(value: string): boolean {
  if (!MONTH_RE.test(value)) return false;
  const parsed = new Date(`${value}-01T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 7) === value;
}

/** Ayın gün sayısı — Şubat ve 30/31 çekişmesi tek yerde çözülsün. */
export function daysInMonth(month: string): number {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
}

/**
 * Dört görev için 7/14/21/ayın sonu YALNIZCA TARİH ÖNERİSİDİR; önizlemede
 * tek tek değiştirilebilir. Farklı adetlerde ay eşit aralıklara bölünür ve
 * son satır her zaman ayın son gününe düşer — Şubat'ta 29/30/31 hatası olmaz.
 */
export function suggestedDueDates(month: string, count: number): string[] {
  if (!isValidPlanMonth(month)) throw new Error("Plan ayı 'YYYY-AA' biçiminde olmalı.");
  if (!Number.isInteger(count) || count < 1 || count > 60) {
    throw new Error("Adet 1 ile 60 arasında bir tam sayı olmalı.");
  }
  const total = daysInMonth(month);
  if (count === 4 && total >= 28) {
    return [7, 14, 21, total].map((day) => `${month}-${String(day).padStart(2, "0")}`);
  }
  return Array.from({ length: count }, (_, index) => {
    const day = index === count - 1
      ? total
      : Math.max(1, Math.min(total, Math.round(((index + 1) * total) / count)));
    return `${month}-${String(day).padStart(2, "0")}`;
  });
}

/**
 * Başlık kalıbı. `{n}` sıra numarası, `{ay}` plan ayı, `{marka}` marka adı.
 * Tanınmayan yer tutucu AYNEN kalır — sessizce silinirse kullanıcı yazdığı
 * metnin kaybolduğunu ancak kayıttan sonra fark ederdi.
 */
export function renderTitlePattern(
  pattern: string,
  values: { index: number; month: string; brandName: string },
): string {
  return pattern
    .replaceAll("{n}", String(values.index))
    .replaceAll("{ay}", values.month)
    .replaceAll("{marka}", values.brandName);
}

export const DEFAULT_TITLE_PATTERN = "{marka} {ay} Reels {n}";

/** Otomasyonun bu ay çalışıp çalışmayacağı: üretim günü geldi mi? */
export function shouldGenerateOn(day: number, generationDay: number): boolean {
  // Ayın 31'inde üretmesi istenen bir plan, 30 günlük ayda son gün çalışsın.
  return day >= generationDay;
}

/** Plan ayı kimliği: aynı ay iki kez üretilmesin diye tekilleştirme anahtarı. */
export function planRunKey(planId: string, planMonth: string): string {
  return `${planId}|${planMonth}`;
}
