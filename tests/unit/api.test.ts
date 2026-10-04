import { createServer } from "node:http";
import pino from "pino";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApiHandler } from "../../src/api/router.js";
import { loadConfig } from "../../src/infrastructure/configuration/config.js";
import { InMemoryMetrics } from "../../src/infrastructure/observability/metrics.js";
import type { Database } from "../../src/infrastructure/database/database.js";
import type { AdminAuthService } from "../../src/modules/admin-auth/service.js";
import type { RoomService } from "../../src/modules/rooms/service.js";
import type { TaskPackRepository } from "../../src/modules/task-packs/repository.js";
import type { UserAuthService } from "../../src/modules/user-auth/service.js";
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
    METRICS_BEARER_TOKEN: "test-metrics-token-at-least-32-characters",
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

function accountServer(userAuth: Partial<UserAuthService>, rooms: Partial<RoomService> = {}) {
  const config = loadConfig({
    APP_ENV: "test",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    CORS_ALLOWED_ORIGINS: "https://game.example",
  });
  const handler = createApiHandler({
    config,
    database: {} as Database,
    logger: pino({ enabled: false }),
    metrics: new InMemoryMetrics(),
    userAuth: userAuth as UserAuthService,
    rooms: rooms as RoomService,
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

  it("protects Prometheus metrics and exposes no API resource identifiers", async () => {
    const agent = testServer();
    await agent.get("/api/v1").expect(200);
    await agent.get("/internal/metrics").expect(404);
    const response = await agent
      .get("/internal/metrics")
      .set("Authorization", "Bearer test-metrics-token-at-least-32-characters")
      .expect(200);
    expect(response.headers["content-type"]).toContain("text/plain");
    expect(response.text).toContain("imposter_game_http_requests_total");
  });

  it("allows documented bearer and transport headers in CORS preflight", async () => {
    const response = await phaseTwoServer({})
      .options("/api/v1/rooms")
      .set("Origin", "https://game.example")
      .expect(204);
    expect(response.headers["access-control-allow-headers"]).toContain("Authorization");
    expect(response.headers["access-control-allow-headers"]).toContain("X-Session-Transport");
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

describe("native account HTTP contract", () => {
  const principal = { userId: "user-id", sessionId: "session-id" };
  const profile = {
    id: "user-id",
    email: "player@example.com",
    displayName: "Player",
    avatarId: "fox" as const,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("accepts an account bearer token on protected profile routes", async () => {
    let credential: string | null = null;
    const response = await accountServer({
      authenticate: (value) => {
        credential = value;
        return Promise.resolve(principal);
      },
      profile: () => Promise.resolve(profile),
    })
      .get("/api/v1/me")
      .set("Authorization", "Bearer account-token")
      .expect(200);

    expect(credential).toBe("account-token");
    const body = response.body as { data: typeof profile };
    expect(body.data).toMatchObject(profile);
  });

  it("does not require browser Origin validation for bearer mutations", async () => {
    let revokedSession: string | null = null;
    await accountServer({
      authenticate: () => Promise.resolve(principal),
      revokeSession: (_principal, sessionId) => {
        revokedSession = sessionId;
        return Promise.resolve();
      },
    })
      .delete("/api/v1/account-sessions/current")
      .set("Authorization", "Bearer account-token")
      .expect(204);

    expect(revokedSession).toBe("session-id");
  });

  it("exposes one-time mobile Google challenge and completion envelopes", async () => {
    const agent = accountServer({
      beginMobileGoogleAuth: (intent) =>
        Promise.resolve({
          transactionToken: `transaction-${intent}`,
          nonce: "nonce",
          expiresAt: "2026-01-01T00:10:00.000Z",
        }),
      completeMobileGoogleAuth: () =>
        Promise.resolve({
          intent: "login" as const,
          returnTo: "/dashboard",
          participantId: null,
          user: profile,
          session: {
            token: "account-token",
            sessionId: "22222222-2222-4222-8222-222222222222",
            expiresAt: "2026-02-01T00:00:00.000Z",
          },
        }),
    });

    const challenge = await agent
      .post("/api/v1/auth/google/mobile/challenges")
      .send({ intent: "login" })
      .expect(201);
    const challengeBody = challenge.body as {
      data: { transactionToken: string; nonce: string };
    };
    expect(challengeBody.data).toMatchObject({
      transactionToken: "transaction-login",
      nonce: "nonce",
    });

    const completion = await agent
      .post("/api/v1/auth/google/mobile/complete")
      .send({ transactionToken: "t".repeat(32), idToken: "i".repeat(100) })
      .expect(200);
    const completionBody = completion.body as {
      data: { session: { token: string; sessionId: string } };
    };
    expect(completionBody.data.session).toMatchObject({
      token: "account-token",
      sessionId: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("returns a participant bearer when an account rejoin requests bearer transport", async () => {
    const participantId = "11111111-1111-4111-8111-111111111111";
    const response = await accountServer(
      { authenticate: () => Promise.resolve(principal) },
      {
        rejoinForUser: () =>
          Promise.resolve({
            room: {
              id: "00000000-0000-4000-8000-000000000001",
              code: "ABC123",
              status: "lobby" as const,
              maxPlayers: 15,
              settings: { selectedTaskPack: null, taskPhaseSeconds: 900 },
              participants: [],
              self: {
                participantId,
                nickname: "Player",
                avatarId: "fox" as const,
                isHost: false,
                capabilities: [],
              },
              expiresAt: "2026-01-01T01:00:00.000Z",
              gameId: null,
            },
            participant: {
              participantId,
              nickname: "Player",
              avatarId: "fox" as const,
              isHost: false,
              capabilities: [],
            },
            sessionToken: "participant-token",
            sessionExpiresAt: "2026-01-01T01:00:00.000Z",
          }),
      },
    )
      .post(`/api/v1/me/participations/${participantId}/rejoin`)
      .set("Authorization", "Bearer account-token")
      .set("X-Session-Transport", "bearer")
      .set("Idempotency-Key", "rejoin-command-1")
      .send({})
      .expect(200);

    expect(response.headers["set-cookie"]).toBeUndefined();
    const body = response.body as { data: { sessionToken: string } };
    expect(body.data.sessionToken).toBe("participant-token");
  });
});
