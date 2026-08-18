import { createServer } from "node:http";
import pino from "pino";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApiHandler } from "../../src/api/router.js";
import { loadConfig } from "../../src/infrastructure/configuration/config.js";
import { InMemoryMetrics } from "../../src/infrastructure/observability/metrics.js";
import type { Database } from "../../src/infrastructure/database/database.js";
import type { AdminAuthService } from "../../src/modules/admin-auth/service.js";
import type { TaskPackRepository } from "../../src/modules/task-packs/repository.js";
import { ApplicationError } from "../../src/shared/errors/application-error.js";

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

function phaseTwoServer(adminAuth: Partial<AdminAuthService>) {
  const config = loadConfig({
    APP_ENV: "test",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    CORS_ALLOWED_ORIGINS: "https://game.example",
  });
  const taskPacks = {
    listPublic: () => Promise.resolve([]),
    listAdmin: () => Promise.resolve([]),
  } as unknown as TaskPackRepository;
  const handler = createApiHandler({
    config,
    database: {} as Database,
    logger: pino({ enabled: false }),
    metrics: new InMemoryMetrics(),
    adminAuth: adminAuth as AdminAuthService,
    taskPacks,
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

describe("Phase 2 HTTP security boundaries", () => {
  it("denies participant catalog reads until participant authentication exists", async () => {
    const response = await phaseTwoServer({}).get("/api/v1/task-packs");
    const body = response.body as { error: { code: string } };
    expect(response.status).toBe(401);
    expect(body.error.code).toBe("SESSION_INVALID");
  });

  it("denies admin catalog reads without an active admin session", async () => {
    const response = await phaseTwoServer({
      authenticate: () =>
        Promise.reject(
          new ApplicationError(
            401,
            "SESSION_INVALID",
            "An active administrator session is required.",
          ),
        ),
    }).get("/api/v1/admin/task-packs");
    expect(response.status).toBe(401);
  });

  it("sets a hardened cookie after successful login", async () => {
    const response = await phaseTwoServer({
      login: () => Promise.resolve({ token: "opaque", maxAgeSeconds: 3600 }),
    })
      .post("/api/v1/admin/sessions")
      .send({ email: "owner@example.com", password: "password" });
    expect(response.status).toBe(204);
    expect(response.headers["set-cookie"]?.[0]).toContain(
      "__Host-admin_session=opaque; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Strict",
    );
  });
});
