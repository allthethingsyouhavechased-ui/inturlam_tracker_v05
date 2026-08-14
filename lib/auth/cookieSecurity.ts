// Oturum çerezinin `secure` bayrağı SABİT olamaz. Uygulama iki farklı biçimde
// servis ediliyor: LAN'da düz HTTP (`next start -H 0.0.0.0 -p 3000`) ve TLS
// sonlandıran bir proxy/tünel arkasında HTTPS. `secure: true` sabitlenseydi
// HTTP üzerinden giren tarayıcı çerezi hiç saklamaz, giriş sessizce başarısız
// olurdu ("şifre doğru ama sayfa giriş ekranına dönüyor"). Bayrağı hiç
// koymamak ise HTTPS kurulumunda token'ı düz metin bir isteğe düşürebilir.
//
// Bu yüzden bayrak isteğin GERÇEK şemasından türetiliyor; kararı saf tutup
// (header + env girdi, boolean çıktı) `tests/cookieSecurity.test.ts`'te
// doğrulayabilmek için burada ayrı bir modülde duruyor.

export const SECURE_COOKIE_ENV = "SESSION_COOKIE_SECURE";

/**
 * @param forwardedProto TLS sonlandıran proxy'nin bıraktığı `x-forwarded-proto`
 *   başlığı (yoksa null). Zincirlenmiş proxy'lerde virgülle ayrılmış olabilir —
 *   İSTEMCİYE en yakın olan İLK değerdir, kullanılan da odur.
 * @param override `SESSION_COOKIE_SECURE` env değeri. Başlığı hiç iletmeyen bir
 *   proxy'nin arkasında otomatik tespit çalışmaz; `1` ile elle açılır, `0` ile
 *   (ör. HTTPS bir tünel üzerinden test ederken) elle kapatılır.
 */
export function shouldUseSecureCookie(
  forwardedProto: string | null | undefined,
  override: string | null | undefined,
): boolean {
  const flag = override?.trim().toLowerCase();
  if (flag === "1" || flag === "true" || flag === "always") return true;
  if (flag === "0" || flag === "false" || flag === "never") return false;

  const proto = forwardedProto?.split(",")[0]?.trim().toLowerCase();
  return proto === "https";
}
