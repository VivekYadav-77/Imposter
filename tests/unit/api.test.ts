import { createServer } from "node:http";
import pino from "pino";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApiHandler } from "../../src/api/router.js";
import { loadConfig } from "../../src/infrastructure/configuration/config.js";
import { InMemoryMetrics } from "../../src/infrastructure/observability/metrics.js";
import type { Database } from "../../src/infrastructure/database/database.js";

const servers: ReturnType<typeof createServer>[] = [];

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

function testServer(readinessCheck: () => Promise<void> = () => Promise.resolve()) {
  const config = loadConfig({
    APP_ENV: "test",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    EXPOSE_API_DOCS: "true",
  });
  const handler = createApiHandler({
    config,
    database: {} as Database,
    logger: pino({ enabled: false }),
    metrics: new InMemoryMetrics(),
    readinessCheck,
  });
  const server = createServer((req, res) => void handler(req, res));
  servers.push(server);
  return request(server);
}

describe("HTTP foundation", () => {
  it("returns the common envelope and preserves a valid request ID", async () => {
    const response = await testServer().get("/api/v1").set("X-Request-ID", "client_request_1");
    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe("client_request_1");
    expect(response.body).toMatchObject({
      data: { version: "v1" },
      meta: { requestId: "client_request_1" },
    });
  });

  it("keeps liveness independent of dependencies", async () => {
    const response = await testServer(() => Promise.reject(new Error("offline"))).get(
      "/health/live",
    );
    expect(response.status).toBe(200);
  });

  it("reports failed readiness as a safe 503 envelope", async () => {
    const response = await testServer(() => Promise.reject(new Error("offline"))).get(
      "/health/ready",
    );
    const body = JSON.parse(response.text) as {
      error: { code: string; message: string };
    };
    expect(response.status).toBe(503);
    expect(body.error.code).toBe("DEPENDENCY_UNAVAILABLE");
    expect(body.error.message).not.toContain("offline");
  });

  it("returns a safe 404 inside the API boundary", async () => {
    const response = await testServer().get("/api/v1/missing");
    const body = JSON.parse(response.text) as { error: { code: string } };
    expect(response.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
