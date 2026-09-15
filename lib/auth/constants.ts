// v02 ve v03 aynı makinede farklı portlarda çalışırken tarayıcı
// cookie'leri port bazında ayırmaz. Ayrı ad, geliştirme oturumunun canlı
// v02 oturumunu ezmesini engeller.
export const IDENTITY_COOKIE = "inturlam_v03_session";

// Paylaşılan ofis bilgisayarlarında unutulmuş bir oturumun haftalarca açık
// kalmasını engeller. Cookie ayrıca tarayıcı oturumu ile sınırlıdır.
export const SESSION_TTL_SECONDS = 60 * 60 * 12;

// "Beni hatırla" seçildiğinde kullanılan süre. Varsayılan 30 gün; ortam
// değişkeniyle (gün cinsinden) değiştirilebilir. Bu süre HEM sunucudaki
// account_sessions.expires_at HEM de çerezin Max-Age'i olarak yazılır:
// ikisi ayrışırsa ya tarayıcı elinde ölü bir çerezle "çıkış yapılmış" gibi
// görünür, ya da sunucuda çerezden uzun yaşayan bir oturum kalır.
export const REMEMBER_ME_ENV = "SESSION_REMEMBER_DAYS";
const DEFAULT_REMEMBER_DAYS = 30;
const MAX_REMEMBER_DAYS = 180;

export function rememberMeTtlSeconds(raw: string | undefined = process.env[REMEMBER_ME_ENV]): number {
  const days = Number(raw);
  const valid = Number.isFinite(days) && days >= 1 && days <= MAX_REMEMBER_DAYS
    ? Math.trunc(days)
    : DEFAULT_REMEMBER_DAYS;
  return valid * 24 * 60 * 60;
}

/** Oturum süresi: "beni hatırla" seçilmediyse mevcut 12 saatlik davranış aynen kalır. */
export function sessionTtlSeconds(remember: boolean): number {
  return remember ? rememberMeTtlSeconds() : SESSION_TTL_SECONDS;
}
