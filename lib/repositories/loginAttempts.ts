import { getDb, plainOne } from "@/lib/db/client";

// Giriş deneme sayaçlarının kalıcı hâli. Süreç belleğindeki `Map`'ten buraya
// taşındı: orada tutulunca sayaç her sunucu yeniden başlatmasında sıfırlanıyor
// ve ikinci bir örnek/worker aynı hesaba SIFIRDAN 5 deneme daha tanıyordu.
// Zaman damgaları epoch milisaniye (INTEGER) — `LoginThrottle` da ms ile
// çalışıyor, SQLite tarafında dönüşüm yapılmasın.
interface LoginAttemptRow {
  failures: number;
  started_at: number;
  blocked_until: number;
}

export interface StoredLoginAttempt {
  failures: number;
  startedAt: number;
  blockedUntil: number;
}

export function getLoginAttempt(key: string): StoredLoginAttempt | undefined {
  const row = plainOne<LoginAttemptRow>(
    getDb()
      .prepare(
        "SELECT failures, started_at, blocked_until FROM login_attempts WHERE attempt_key = ?",
      )
      .get(key),
  );
  if (!row) return undefined;
  return {
    failures: row.failures,
    startedAt: row.started_at,
    blockedUntil: row.blocked_until,
  };
}

export function saveLoginAttempt(key: string, attempt: StoredLoginAttempt): void {
  getDb()
    .prepare(
      `INSERT INTO login_attempts (attempt_key, failures, started_at, blocked_until)
            VALUES (?, ?, ?, ?)
       ON CONFLICT(attempt_key) DO UPDATE SET
            failures      = excluded.failures,
            started_at    = excluded.started_at,
            blocked_until = excluded.blocked_until`,
    )
    .run(key, attempt.failures, attempt.startedAt, attempt.blockedUntil);
}

export function deleteLoginAttempt(key: string): void {
  getDb().prepare("DELETE FROM login_attempts WHERE attempt_key = ?").run(key);
}

/**
 * Penceresi kapanmış satırları siler. `Map` sürümünde budama hiç yoktu: var
 * olmayan kullanıcı adlarını tarayan bir istemci sınırsız anahtar biriktirirdi.
 * Yazma yolunda (her başarısız denemede) çağrılıyor — ayrı bir zamanlayıcı yok.
 */
export function pruneLoginAttempts(expiredBefore: number): void {
  getDb()
    .prepare("DELETE FROM login_attempts WHERE started_at < ? AND blocked_until <= ?")
    .run(expiredBefore, expiredBefore);
}
