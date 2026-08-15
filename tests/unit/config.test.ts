import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/infrastructure/configuration/config.js";

describe("loadConfig", () => {
  it("normalizes a valid environment", () => {
    const config = loadConfig({ DATABASE_URL: "postgresql://user:pass@localhost:5432/game" });
    expect(config.port).toBe(3000);
    expect(config.databaseSsl).toBe(false);
  });

  it("fails startup configuration without a database URL", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it("rejects unsupported environments", () => {
    expect(() =>
      loadConfig({ APP_ENV: "staging", DATABASE_URL: "postgresql://localhost/game" }),
    ).toThrow(/APP_ENV/);
  });
});
