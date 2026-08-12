// v02 ve v03 aynı makinede farklı portlarda çalışırken tarayıcı
// cookie'leri port bazında ayırmaz. Ayrı ad, geliştirme oturumunun canlı
// v02 oturumunu ezmesini engeller.
export const IDENTITY_COOKIE = "inturlam_v03_session";

// Paylaşılan ofis bilgisayarlarında unutulmuş bir oturumun haftalarca açık
// kalmasını engeller. Cookie ayrıca tarayıcı oturumu ile sınırlıdır.
export const SESSION_TTL_SECONDS = 60 * 60 * 12;
