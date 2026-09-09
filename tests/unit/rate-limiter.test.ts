import { describe, expect, it } from "vitest";

import { MemoryRateLimiter } from "../../src/infrastructure/security/rate-limiter.js";

describe("MemoryRateLimiter", () => {
  it("limits a bucket and resets it after the configured window", () => {
    const limiter = new MemoryRateLimiter(2, 10);
    expect(limiter.consume("client", 1_000).allowed).toBe(true);
    expect(limiter.consume("client", 1_001).allowed).toBe(true);
    expect(limiter.consume("client", 1_002)).toMatchObject({
      allowed: false,
      retryAfterSeconds: 10,
    });
    expect(limiter.consume("client", 11_000).allowed).toBe(true);
  });
});
