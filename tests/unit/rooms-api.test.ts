import { createServer } from "node:http";
import pino from "pino";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApiHandler } from "../../src/api/router.js";
import { loadConfig } from "../../src/infrastructure/configuration/config.js";
import type { Database } from "../../src/infrastructure/database/database.js";
import { InMemoryMetrics } from "../../src/infrastructure/observability/metrics.js";
import type { RoomService } from "../../src/modules/rooms/service.js";
import type { GameService } from "../../src/modules/games/service.js";
import type { EvidenceService } from "../../src/modules/evidence/service.js";
import {
  normalizeNickname,
  roomMembershipSchema,
  roomSettingsSchema,
} from "../../src/modules/rooms/schemas.js";

const servers: ReturnType<typeof createServer>[] = [];
afterEach(async () =>
  Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  ),
);

describe("host gameplay settings", () => {
  it("accepts a 240 minute game and rejects anything longer", () => {
    expect(roomSettingsSchema.safeParse({ taskPhaseSeconds: 14_400 }).success).toBe(true);
    expect(roomSettingsSchema.safeParse({ taskPhaseSeconds: 14_401 }).success).toBe(false);
  });

  it("validates evidence, meeting prerequisite, and cooldown choices", () => {
    expect(
      roomSettingsSchema.safeParse({
        evidenceVisibility: "private",
        imposterMeetingTaskRequirement: "none",
        meetingCooldownSeconds: 180,
      }).success,
    ).toBe(true);
    expect(roomSettingsSchema.safeParse({ meetingCooldownSeconds: 1_801 }).success).toBe(false);
  });
});

const snapshot = {
  id: "00000000-0000-4000-8000-000000000001",
  code: "ABC234",
  status: "lobby" as const,
  maxPlayers: 12 as const,
  settings: {
    selectedTaskPack: null,
    taskPhaseSeconds: 900,
    discussionSeconds: 90,
    reviewSeconds: 60,
    votingSeconds: 60,
  },
  participants: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      nickname: "Asha",
      avatarId: "fox" as const,
      isHost: true,
      presence: "connected" as const,
      joinedAt: new Date(0).toISOString(),
    },
  ],
  self: {
    participantId: "00000000-0000-4000-8000-000000000002",
    nickname: "Asha",
    avatarId: "fox" as const,
    isHost: true,
    capabilities: ["change_settings"],
  },
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  gameId: null,
};

function roomApi(options: { games?: GameService; evidence?: EvidenceService } = {}) {
  const rooms = {
    createRoom: () =>
      Promise.resolve({
        room: snapshot,
        participant: snapshot.self,
        sessionToken: "raw-secret-token",
        sessionExpiresAt: snapshot.expiresAt,
      }),
    authenticate: (token: string) =>
      Promise.resolve(
        token === "valid"
          ? {
              participantId: snapshot.self.participantId,
              roomId: snapshot.id,
              sessionId: "session",
            }
          : null,
      ),
    snapshot: () => Promise.resolve(snapshot),
    joinOptions: () => Promise.resolve({ availableAvatarIds: ["owl", "wolf"], spotsRemaining: 11 }),
  } as unknown as RoomService;
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
    rooms,
    games: options.games,
    evidence: options.evidence,
  });
  const server = createServer((req, res) => void handler(req, res));
  servers.push(server);
  return request(server);
}

describe("room HTTP transport", () => {
  it("returns only public join availability without requiring a session", async () => {
    const response = await roomApi().get("/api/v1/rooms/ABC234/join-options");
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toBe("no-store");
    const body = response.body as { data: unknown };
    expect(body.data).toEqual({
      availableAvatarIds: ["owl", "wolf"],
      spotsRemaining: 11,
    });
  });

  it("returns bearer credentials to native clients", async () => {
    const response = await roomApi()
      .post("/api/v1/rooms")
      .set("Idempotency-Key", "create-room-1")
      .send({ nickname: "Asha" });
    expect(response.status).toBe(201);
    const body = response.body as { data: { sessionToken: string } };
    expect(body.data.sessionToken).toBe("raw-secret-token");
  });

  it("keeps web credentials out of JSON and uses a hardened cookie", async () => {
    const response = await roomApi()
      .post("/api/v1/rooms")
      .set("Idempotency-Key", "create-room-2")
      .set("X-Session-Transport", "cookie")
      .send({ nickname: "Asha" });
    expect(response.status).toBe(201);
    expect(JSON.stringify(response.body)).not.toContain("raw-secret-token");
    expect(response.headers["set-cookie"]?.[0]).toContain(
      "__Host-participant_session=raw-secret-token",
    );
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly; Secure; SameSite=Strict");
  });

  it("denies a cross-session snapshot without a valid credential", async () => {
    const denied = await roomApi()
      .get("/api/v1/rooms/current")
      .set("Authorization", "Bearer invalid");
    expect(denied.status).toBe(401);
    const allowed = await roomApi()
      .get("/api/v1/rooms/current")
      .set("Authorization", "Bearer valid");
    expect(allowed.status).toBe(200);
  });

  it("uses version-aware game snapshots", async () => {
    const gameSnapshot = {
      id: "00000000-0000-4000-8000-000000000010",
      stateVersion: 7,
    };
    const games = {
      snapshot: () => Promise.resolve(gameSnapshot),
    } as unknown as GameService;
    const response = await roomApi({ games })
      .get("/api/v1/games/current/snapshot?knownStateVersion=7")
      .set("Authorization", "Bearer valid");
    expect(response.status).toBe(204);
    expect(response.headers.etag).toBe('"7"');
  });

  it("returns the privacy policy with a constrained upload capability", async () => {
    const games = {} as GameService;
    const evidence = {
      createUploadIntent: () =>
        Promise.resolve({
          uploadId: "00000000-0000-4000-8000-000000000020",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          method: "PUT",
          url: "https://storage.example/signed",
          headers: { "content-type": "image/jpeg", "content-length": "12" },
          policy: {
            version: "2026-09-20",
            minimumAge: 18,
            retentionHours: 24,
            notice: "Consent notice",
          },
        }),
    } as unknown as EvidenceService;
    const response = await roomApi({ games, evidence })
      .post("/api/v1/task-assignments/00000000-0000-4000-8000-000000000011/upload-intents")
      .set("Authorization", "Bearer valid")
      .set("Idempotency-Key", "evidence-intent-1")
      .send({ expectedStateVersion: 1, contentType: "image/jpeg", byteSize: 12 });
    expect(response.status).toBe(201);
    const body = response.body as {
      data: { policy: { minimumAge: number; retentionHours: number } };
    };
    expect(body.data.policy).toMatchObject({ minimumAge: 18, retentionHours: 24 });
    expect(body.data).not.toHaveProperty("objectKey");
  });
});

describe("nickname normalization", () => {
  it("normalizes compatibility characters, case, and whitespace consistently", () => {
    expect(normalizeNickname("  ＡSHA\t  Rao ")).toEqual({
      display: "ASHA Rao",
      normalized: "asha rao",
    });
  });

  it("rejects control characters and more than 24 display code points", () => {
    expect(roomMembershipSchema.safeParse({ nickname: "bad\u0000name" }).success).toBe(false);
    expect(roomMembershipSchema.safeParse({ nickname: "x".repeat(25) }).success).toBe(false);
  });

  it("accepts only catalog avatar identifiers while preserving legacy omission", () => {
    expect(roomMembershipSchema.safeParse({ nickname: "Asha", avatarId: "fox" }).success).toBe(
      true,
    );
    expect(roomMembershipSchema.safeParse({ nickname: "Asha" }).success).toBe(true);
    expect(roomMembershipSchema.safeParse({ nickname: "Asha", avatarId: "crewmate" }).success).toBe(
      false,
    );
  });
});
