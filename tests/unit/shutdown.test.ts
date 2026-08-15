import pino from "pino";
import { describe, expect, it, vi } from "vitest";

import { ShutdownManager } from "../../src/server/shutdown.js";

describe("ShutdownManager", () => {
  it("drains each registered resource once", async () => {
    const first = vi.fn(() => Promise.resolve());
    const second = vi.fn(() => Promise.resolve());
    const manager = new ShutdownManager(pino({ enabled: false }), 1000, [first, second]);
    await Promise.all([manager.shutdown("test"), manager.shutdown("duplicate")]);
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });
});
