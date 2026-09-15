// Mesai süresi hesabının SAF kuralları.
//
// SUNUCU ZAMANI ESASTIR; tarayıcıdaki sayaç yalnızca gösterimdir. Buradaki
// fonksiyonlar UTC damgalarıyla çalışır ve İstanbul takvimine göre günlere
// dağıtır — gece yarısını aşan mesai iki güne DOĞRU bölünür.

const ISTANBUL_OFFSET_MINUTES = 3 * 60; // UTC+03:00, yaz saati yok.
const MS_PER_MINUTE = 60_000;

export type WorkState = "calismiyor" | "calisiyor" | "molada" | "tamamlandi";

export const WORK_STATE_LABEL: Record<WorkState, string> = {
  calismiyor: "Çalışmıyor",
  calisiyor: "Çalışıyor",
  molada: "Molada",
  tamamlandi: "Tamamlandı",
};

export interface Interval {
  start: string;
  end: string | null;
}

export function parseStamp(stamp: string): number {
  const normalized = stamp.includes("T") ? stamp : `${stamp.replace(" ", "T")}Z`;
  const value = Date.parse(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
  if (Number.isNaN(value)) throw new Error(`Geçersiz zaman damgası: ${stamp}`);
  return value;
}

/** UTC damgasından İstanbul takvim günü ('YYYY-MM-DD'). */
export function istanbulDayOf(stamp: string): string {
  return new Date(parseStamp(stamp) + ISTANBUL_OFFSET_MINUTES * MS_PER_MINUTE)
    .toISOString()
    .slice(0, 10);
}

/** İstanbul günü 'YYYY-MM-DD' için gün başlangıcının UTC milisaniyesi. */
function istanbulDayStartUtc(day: string): number {
  return Date.parse(`${day}T00:00:00Z`) - ISTANBUL_OFFSET_MINUTES * MS_PER_MINUTE;
}

/**
 * Bir aralığın toplam dakikası. Açık aralık (`end === null`) için `now`
 * kullanılır — bu, "tarayıcı kapansa da kayıt sürer" davranışının karşılığı.
 */
export function intervalMinutes(interval: Interval, now: number): number {
  const start = parseStamp(interval.start);
  const end = interval.end ? parseStamp(interval.end) : now;
  return Math.max(0, Math.round((end - start) / MS_PER_MINUTE));
}

/**
 * NET süre: çalışma aralığından MOLALAR çıkarılır. Mola çalışma aralığının
 * dışına taşarsa yalnızca kesişen kısmı düşülür (bozuk veri net süreyi
 * negatife çekmesin).
 */
export function netMinutes(work: Interval, breaks: Interval[], now: number): number {
  const workStart = parseStamp(work.start);
  const workEnd = work.end ? parseStamp(work.end) : now;
  const gross = Math.max(0, workEnd - workStart);
  const breakMs = breaks.reduce((sum, item) => {
    const start = Math.max(workStart, parseStamp(item.start));
    const end = Math.min(workEnd, item.end ? parseStamp(item.end) : now);
    return sum + Math.max(0, end - start);
  }, 0);
  return Math.max(0, Math.round((gross - breakMs) / MS_PER_MINUTE));
}

export interface DaySlice {
  day: string;
  minutes: number;
}

/**
 * Gece yarısını aşan süreyi İstanbul takvimine göre İKİ GÜNE dağıtır.
 * 23:00–02:00 çalışan biri iki günde de görünmeli; tek güne yazmak hem günlük
 * özeti hem ertesi günün "hiç çalışmadı" görüntüsünü yanlış yapar.
 */
export function splitByIstanbulDay(work: Interval, breaks: Interval[], now: number): DaySlice[] {
  const start = parseStamp(work.start);
  const end = work.end ? parseStamp(work.end) : now;
  if (end <= start) return [];
  const slices: DaySlice[] = [];
  let cursor = start;
  while (cursor < end) {
    const day = istanbulDayOf(new Date(cursor).toISOString());
    const nextDayStart = istanbulDayStartUtc(day) + 24 * 60 * MS_PER_MINUTE;
    const sliceEnd = Math.min(end, nextDayStart);
    const minutes = netMinutes(
      { start: new Date(cursor).toISOString(), end: new Date(sliceEnd).toISOString() },
      breaks,
      now,
    );
    if (minutes > 0) slices.push({ day, minutes });
    cursor = sliceEnd;
  }
  return slices;
}

export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} dk`;
  return `${hours} sa ${String(rest).padStart(2, "0")} dk`;
}

/**
 * Açık kalmış kayıt uyarısı. Otomatik KAPATMA yok: saat uydurmak, gerçek
 * mesaiyi gizler. Kullanıcı gerekçeli düzeltme ister, yönetici onaylar.
 */
export const STALE_SESSION_HOURS = 16;

/**
 * Toplam mola uyarı eşiği. Tek tek molalar değil, GÜNÜN TOPLAM molası sayılır:
 * üç kez 25 dakika mola veren de bu eşiği aşar.
 */
export const BREAK_ALERT_MINUTES = 60;

export function breakLimitExceeded(totalBreakMinutes: number): boolean {
  return totalBreakMinutes > BREAK_ALERT_MINUTES;
}

export function isStaleOpenSession(startedAt: string, now: number): boolean {
  return now - parseStamp(startedAt) > STALE_SESSION_HOURS * 60 * MS_PER_MINUTE;
}

/**
 * Sunucu saatini TEK yerden okur. Sayfa bileşeni `Date.now()`u doğrudan
 * çağırmıyor: React'in saflık kuralı render içinde impure çağrıyı reddediyor
 * ve haklı — bu değer sunucu render'ına ait bir girdi, bileşenin kendi
 * hesabı değil.
 */
export function serverNow(): { ms: number; istanbulDay: string } {
  const ms = Date.now();
  return { ms, istanbulDay: istanbulDayOf(new Date(ms).toISOString()) };
}
