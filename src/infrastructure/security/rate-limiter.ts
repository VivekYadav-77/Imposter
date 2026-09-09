export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetsAt: number;
}

/** Fixed-window limiter for the approved single-process production topology. */
export class MemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly maximum: number,
    private readonly windowSeconds: number,
  ) {}

  consume(key: string, now = Date.now()): RateLimitResult {
    const existing = this.buckets.get(key);
    const bucket =
      !existing || existing.resetsAt <= now
        ? { count: 0, resetsAt: now + this.windowSeconds * 1000 }
        : existing;
    bucket.count += 1;
    this.buckets.set(key, bucket);
    if (this.buckets.size > 10_000) this.removeExpired(now);
    return {
      allowed: bucket.count <= this.maximum,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetsAt - now) / 1000)),
    };
  }

  private removeExpired(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetsAt <= now) this.buckets.delete(key);
    }
  }
}
