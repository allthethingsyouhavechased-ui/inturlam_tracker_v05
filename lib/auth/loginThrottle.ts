export interface LoginAttempt {
  failures: number;
  startedAt: number;
  blockedUntil: number;
}

// Sayaçların NEREDE durduğu takılabilir. Sebep: deneme geçmişi bir süre yalnız
// modül içindeki `Map`'te yaşadı; o hâliyle sunucu her yeniden başladığında
// sıfırlanıyor ve birden fazla worker/örnek arkasında paylaşılmıyordu (N örnek
// = 5N deneme). Üretimde SQLite destekli store kullanılıyor
// (lib/auth/loginThrottleStore.ts); bellek store'u varsayılan olarak kalıyor
// çünkü sınıfın kendi kuralları (pencere, eşik, sıfırlama) DB'siz test
// edilebilmeli.
export interface LoginAttemptStore {
  get(key: string): LoginAttempt | undefined;
  set(key: string, attempt: LoginAttempt): void;
  delete(key: string): void;
}

export function memoryLoginAttemptStore(): LoginAttemptStore {
  const attempts = new Map<string, LoginAttempt>();
  return {
    get: (key) => attempts.get(key),
    set: (key, attempt) => {
      attempts.set(key, attempt);
    },
    delete: (key) => {
      attempts.delete(key);
    },
  };
}

export class LoginThrottle {
  private readonly store: LoginAttemptStore;
  private readonly maxFailures: number;
  private readonly windowMs: number;

  constructor(
    maxFailures: number,
    windowMs: number,
    store: LoginAttemptStore = memoryLoginAttemptStore(),
  ) {
    this.maxFailures = maxFailures;
    this.windowMs = windowMs;
    this.store = store;
  }

  isBlocked(key: string, now = Date.now()): boolean {
    const attempt = this.store.get(key);
    if (!attempt) return false;
    if (attempt.blockedUntil > now) return true;
    if (now - attempt.startedAt >= this.windowMs) this.store.delete(key);
    return false;
  }

  recordFailure(key: string, now = Date.now()): void {
    const current = this.store.get(key);
    const attempt = !current || now - current.startedAt >= this.windowMs
      ? { failures: 0, startedAt: now, blockedUntil: 0 }
      : current;
    attempt.failures += 1;
    if (attempt.failures >= this.maxFailures) attempt.blockedUntil = now + this.windowMs;
    this.store.set(key, attempt);
  }

  reset(key: string): void {
    this.store.delete(key);
  }
}
