export interface LoginThrottle {
  check(key: string, now?: number): { allowed: boolean; retryAfterSeconds?: number };
  recordFailure(key: string, now?: number): void;
  clear(key: string): void;
}

export class MemoryLoginThrottle implements LoginThrottle {
  private readonly attempts = new Map<string, number[]>();

  constructor(
    private readonly maximumAttempts: number,
    private readonly windowSeconds: number,
  ) {}

  check(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds?: number } {
    const cutoff = now - this.windowSeconds * 1000;
    const recent = (this.attempts.get(key) ?? []).filter((attempt) => attempt > cutoff);
    this.attempts.set(key, recent);
    if (recent.length < this.maximumAttempts) return { allowed: true };
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((recent[0] + this.windowSeconds * 1000 - now) / 1000),
      ),
    };
  }

  recordFailure(key: string, now = Date.now()): void {
    const entries = this.attempts.get(key) ?? [];
    entries.push(now);
    this.attempts.set(key, entries);
  }

  clear(key: string): void {
    this.attempts.delete(key);
  }
}
