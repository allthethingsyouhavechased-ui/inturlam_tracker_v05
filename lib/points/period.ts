// Hak ediş dönemi İSTANBUL takvim ayıdır.
//
// SQLite `datetime('now')` UTC yazıyor. Ayın son gününün 22:30'unda (TSİ)
// verilen bir onay UTC'de 19:30 — aynı ay. Ama ayın ilk gününün 01:30'unda
// (TSİ) verilen onay UTC'de bir ÖNCEKİ ayın 22:30'u: ham UTC damgasından ay
// alınırsa hak ediş bir önceki aya yazılır. Bu yüzden ay, damga İstanbul'a
// çevrildikten sonra okunuyor.

const ISTANBUL_OFFSET_MINUTES = 3 * 60; // UTC+03:00, yaz saati uygulaması yok.

function parseUtc(stamp: string): Date {
  // SQLite "YYYY-MM-DD HH:MM:SS" (UTC) yazar; ISO damgası da kabul edilir.
  const normalized = stamp.includes("T") ? stamp : `${stamp.replace(" ", "T")}Z`;
  const date = new Date(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Geçersiz zaman damgası: ${stamp}`);
  return date;
}

/** UTC damgasından İstanbul takvim ayı ('YYYY-MM'). */
export function istanbulMonth(stamp: string): string {
  const date = parseUtc(stamp);
  date.setUTCMinutes(date.getUTCMinutes() + ISTANBUL_OFFSET_MINUTES);
  return date.toISOString().slice(0, 7);
}

/** UTC damgasından İstanbul takvim günü ('YYYY-MM-DD'). */
export function istanbulDay(stamp: string): string {
  const date = parseUtc(stamp);
  date.setUTCMinutes(date.getUTCMinutes() + ISTANBUL_OFFSET_MINUTES);
  return date.toISOString().slice(0, 10);
}

const MONTH_RE = /^\d{4}-\d{2}$/;

export function isValidPointMonth(value: string): boolean {
  if (!MONTH_RE.test(value)) return false;
  const parsed = new Date(`${value}-01T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 7) === value;
}

export function assertPointMonth(value: string): string {
  if (!isValidPointMonth(value)) throw new Error("Dönem 'YYYY-AA' biçiminde olmalı.");
  return value;
}
