// Giriş ekranına yazılan kullanıcı adı. Kişi id'sinden AYRI bir alan olarak
// duruyor: `people.id` onlarca tabloda foreign key (görev, yorum, bildirim,
// oturum…), değiştirilebilir bir kimlik olamaz. Kullanıcı adı ise ekip
// yönetiminden serbestçe düzeltilebilmeli.
//
// Yalnızca ASCII: Türkçe "İ/ı" büyük-küçük dönüşümü yerele göre değiştiği için
// "İsmail" yazan biriyle "ismail" kaydı bir ortamda eşleşip başka bir ortamda
// eşleşmeyebilirdi. Kullanıcı adı benzersizliği buna dayanamaz, o yüzden alfabe
// daraltıldı — görünen ad (`people.name`) Türkçe karakteri elbette kabul ediyor.
const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{2,31}$/;

export const USERNAME_RULE =
  "Kullanıcı adı 3-32 karakter olmalı; sadece İngilizce harf, rakam, nokta, alt çizgi ve tire içerebilir.";

/**
 * Saklanacak/karşılaştırılacak biçim: kırpılmış + küçük harf. Alfabe ASCII
 * olduğu için düz `toLowerCase()` yeterli ve yerelden bağımsız.
 * Geçersiz değerlerde `null` döner — çağıran hata mesajını kendi verir.
 */
export function normalizeUsername(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  return USERNAME_PATTERN.test(raw) ? raw.toLowerCase() : null;
}

/** Giriş denemesinde yazılan metni aramaya hazırlar (doğrulama yapmaz). */
export function usernameLookupKey(value: string | null | undefined): string | null {
  const raw = value?.trim().toLowerCase();
  return raw && raw.length > 0 ? raw : null;
}
