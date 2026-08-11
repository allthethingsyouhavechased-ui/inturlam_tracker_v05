interface LoginAttempt {
  failures: number;
  startedAt: number;
  blockedUntil: number;
}

export class LoginThrottle {
  private readonly attempts = new Map<string, LoginAttempt>();
  private readonly maxFailures: number;
  private readonly windowMs: number;

  constructor(maxFailures: number, windowMs: number) {
    this.maxFailures = maxFailures;
    this.windowMs = windowMs;
  }

  isBlocked(key: string, now = Date.now()): boolean {
    const attempt = this.attempts.get(key);
    if (!attempt) return false;
    if (attempt.blockedUntil > now) return true;
    if (now - attempt.startedAt >= this.windowMs) this.attempts.delete(key);
    return false;
  }

  recordFailure(key: string, now = Date.now()): void {
    const current = this.attempts.get(key);
    const attempt = !current || now - current.startedAt >= this.windowMs
      ? { failures: 0, startedAt: now, blockedUntil: 0 }
      : current;
    attempt.failures += 1;
    if (attempt.failures >= this.maxFailures) attempt.blockedUntil = now + this.windowMs;
    this.attempts.set(key, attempt);
  }

  reset(key: string): void {
    this.attempts.delete(key);
  }
}
