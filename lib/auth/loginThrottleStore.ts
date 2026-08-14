import type { LoginAttempt, LoginAttemptStore } from "@/lib/auth/loginThrottle";
import {
  deleteLoginAttempt,
  getLoginAttempt,
  pruneLoginAttempts,
  saveLoginAttempt,
} from "@/lib/repositories/loginAttempts";

/**
 * `LoginThrottle`'ı SQLite'a bağlayan adaptör. Sayaç artık süreç belleğinde
 * değil `data/inturlam.db`'de durduğu için hem sunucu yeniden başlatmasını
 * hem de ikinci bir örnek/worker'ı aşar.
 *
 * @param windowMs Sınırlama penceresi; budamanın "artık kimseyi ilgilendirmeyen
 *   satır" eşiğini hesaplamak için gerekiyor.
 */
export function sqliteLoginAttemptStore(windowMs: number): LoginAttemptStore {
  return {
    get: (key) => getLoginAttempt(key),
    set: (key, attempt: LoginAttempt) => {
      saveLoginAttempt(key, attempt);
      // Budama yazma yolunda: başarısız denemeler zaten seyrek, ayrı bir
      // zamanlayıcıya (dev sunucusunda sızacak bir setInterval'a) gerek yok.
      //
      // Eşik `Date.now()` DEĞİL yazılan denemenin kendi damgasından türetiliyor:
      // `LoginThrottle` saati dışarıdan alabiliyor (testler sabit bir `now`
      // veriyor) ve duvar saatiyle karışınca budama az önce yazılan satırı
      // hemen silebiliyordu. Üretimde ikisi zaten aynı.
      pruneLoginAttempts(attempt.startedAt - windowMs);
    },
    delete: (key) => deleteLoginAttempt(key),
  };
}
