import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/infrastructure/configuration/config.js";

describe("loadConfig", () => {
  it("normalizes a valid environment", () => {
    const config = loadConfig({ DATABASE_URL: "postgresql://user:pass@localhost:5432/game" });
    expect(config.port).toBe(3000);
    expect(config.databaseSsl).toBe(false);
    expect(config.realtimeDisconnectGraceMs).toBe(5000);
  });

  it("fails startup configuration without a database URL", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it("rejects unsupported environments", () => {
    expect(() =>
      loadConfig({ APP_ENV: "staging", DATABASE_URL: "postgresql://localhost/game" }),
    ).toThrow(/APP_ENV/);
  });

  it("rejects unsafe production defaults and accepts an explicit hardened environment", () => {
    expect(() =>
      loadConfig({ APP_ENV: "production", DATABASE_URL: "postgresql://localhost/game" }),
    ).toThrow(/ADMIN_SESSION_TOKEN_PEPPER/);
    const config = loadConfig({
      APP_ENV: "production",
      DATABASE_URL: "postgresql://localhost/game",
      ADMIN_SESSION_TOKEN_PEPPER: "admin-production-pepper-at-least-32-chars",
      PARTICIPANT_SESSION_TOKEN_PEPPER: "participant-production-pepper-32-chars",
      METRICS_BEARER_TOKEN: "metrics-production-token-at-least-32-chars",
      SERVICE_VERSION: "sha-123",
      CORS_ALLOWED_ORIGINS: "https://game.example",
      CSP_IMAGE_SOURCES: "https://evidence.example",
      TRUST_PROXY: "true",
    });
    expect(config.appEnv).toBe("production");
    expect(config.serviceVersion).toBe("sha-123");
  });

  it("rejects inconsistent HTTP timeout configuration", () => {
    expect(() =>
      loadConfig({
        DATABASE_URL: "postgresql://localhost/game",
        HTTP_REQUEST_TIMEOUT_MS: "1000",
        HTTP_HEADERS_TIMEOUT_MS: "2000",
      }),
    ).toThrow(/HTTP_HEADERS_TIMEOUT_MS/);
  });
});
