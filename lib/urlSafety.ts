// Dışarıdan gelen (kullanıcı girdisi ya da scraper çıktısı) bir adresi `href`
// olarak render etmeden ÖNCE şemasını doğrula. `javascript:` şemalı bir değer
// tıklanabilir bir bağlantı olarak çizilirse tıklayan kişinin oturumunda script
// çalışır — depolanmış XSS. Kontrol tek yerde toplandı ki yeni bir bağlantı
// alanı eklerken "burada da gerekiyor muydu" sorusu sorulmasın.
const SAFE_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Yalnızca http/https adresleri geri döner; başka her şey (`javascript:`,
 * `data:`, `vbscript:`, bozuk metin, boş değer) `null`'dır. `null` dönmesi
 * çağıran tarafta "bağlantı hiç verme" anlamına gelir — güvenli varsayılan.
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    return SAFE_PROTOCOLS.has(parsed.protocol) ? parsed.toString() : null;
  } catch {
    // Mutlak olmayan/ayrıştırılamayan değerler de reddedilir: göreli bir yol
    // burada beklenmiyor, dış bağlantı alanlarına giriyor.
    return null;
  }
}
