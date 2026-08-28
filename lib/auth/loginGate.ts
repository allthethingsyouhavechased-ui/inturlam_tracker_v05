import { LoginThrottle } from "@/lib/auth/loginThrottle";
import { sqliteLoginAttemptStore } from "@/lib/auth/loginThrottleStore";

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const MAX_LOGIN_FAILURES = 5;

// Sayaçlar SQLite'ta: süreç belleğinde tutulunca her yeniden başlatma sınırı
// sıfırlıyor, ikinci bir örnek/worker de aynı hesaba baştan 5 deneme tanıyordu.
//
// Bu modül `lib/actions/identity.ts`ten AYRI: orası bir `"use server"` dosyası
// ve oradan async olmayan bir değer export edilemiyor. Şifre sıfırlayan
// action'ın kilidi açabilmesi için sayaç ortak bir yerde durmalı.
export const loginThrottle = new LoginThrottle(
  MAX_LOGIN_FAILURES,
  LOGIN_WINDOW_MS,
  sqliteLoginAttemptStore(LOGIN_WINDOW_MS),
);

export function teamThrottleKey(identifier: string): string {
  return `team:${identifier.toLocaleLowerCase("tr-TR")}`;
}

export function guestThrottleKey(username: string): string {
  return `guest:${username.toLocaleLowerCase("tr-TR")}`;
}

/**
 * Şifresi yenilenen bir hesabın giriş kilidini kaldırır.
 *
 * Bu olmadan "şifremi unuttum" akışı yarım kalıyordu: yönetici yeni şifreyi
 * veriyor ama kişi 15 dakika daha giremiyor ve ekranda "çok fazla hatalı
 * deneme" yazıyordu — oysa artık elinde DOĞRU şifre var. Kilit, bilinmeyen
 * şifreyi denemeye karşı; şifre değiştiği anda koruduğu şey ortadan kalkıyor.
 *
 * Hem kişi id'si hem kullanıcı adı temizleniyor: sayaç anahtarı, girilen ad bir
 * hesapla eşleşmediğinde ham kullanıcı adından türetiliyor, yani kişi kendi
 * kullanıcı adını yanlış yazarak da kilitlenmiş olabilir.
 */
export function clearLoginBlockForPerson(personId: string, username: string | null): void {
  loginThrottle.reset(teamThrottleKey(personId));
  if (username) loginThrottle.reset(teamThrottleKey(username));
}

export function clearLoginBlockForGuest(username: string): void {
  loginThrottle.reset(guestThrottleKey(username));
}
