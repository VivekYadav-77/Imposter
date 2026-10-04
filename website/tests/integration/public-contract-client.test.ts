import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import pino from "pino";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApiHandler } from "../../src/api/router.js";
import { loadConfig } from "../../src/infrastructure/configuration/config.js";
import {
  closeDatabase,
  createDatabase,
  type DatabaseDependencies,
} from "../../src/infrastructure/database/database.js";
import { InMemoryMetrics } from "../../src/infrastructure/observability/metrics.js";
import { GameService } from "../../src/modules/games/service.js";
import { RoomService } from "../../src/modules/rooms/service.js";

const connectionString = process.env.TEST_DATABASE_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;

interface SessionIssue {
  room: { id: string; code: string };
  participant: { participantId: string };
  sessionToken: string;
}

interface GameSnapshot {
  id: string;
  stateVersion: number;
  phase: string;
  winner: "crew" | "imposters" | null;
  self: { participantId: string; role: "crew" | "imposter"; lifeStatus: string };
  participants: Array<{ id: string; lifeStatus: string }>;
  meeting: { id: string } | null;
}

interface VoteAcknowledgement {
  resolved: boolean;
  winner: "crew" | "imposters" | null;
}

class NativeContractClient {
  constructor(
    private readonly server: Server,
    readonly token: string,
    readonly participantId: string,
  ) {}

  private authorization() {
    return { Authorization: `Bearer ${this.token}` };
  }

  async snapshot(): Promise<GameSnapshot> {
    const response = await request(this.server)
      .get("/api/v1/games/current/snapshot")
      .set(this.authorization())
      .expect(200);
    return (response.body as unknown as { data: GameSnapshot }).data;
  }

  async kill(expectedStateVersion: number, targetParticipantId: string): Promise<void> {
    await request(this.server)
      .post("/api/v1/games/current/kills")
      .set(this.authorization())
      .set("Idempotency-Key", randomUUID())
      .send({ expectedStateVersion, targetParticipantId })
      .expect(201);
  }

  async callMeeting(expectedStateVersion: number): Promise<GameSnapshot> {
    const response = await request(this.server)
      .post("/api/v1/games/current/meetings")
      .set(this.authorization())
      .set("Idempotency-Key", randomUUID())
      .send({ expectedStateVersion })
      .expect(201);
    return (response.body as unknown as { data: GameSnapshot }).data;
  }

  async vote(
    meetingId: string,
    expectedStateVersion: number,
    targetParticipantId: string,
  ): Promise<VoteAcknowledgement> {
    const response = await request(this.server)
      .put(`/api/v1/meetings/${meetingId}/ejection-vote`)
      .set(this.authorization())
      .set("Idempotency-Key", randomUUID())
      .send({ expectedStateVersion, targetParticipantId })
      .expect(200);
    return (response.body as unknown as { data: VoteAcknowledgement }).data;
  }
}

describeWithDatabase("non-React client against the frozen public contract", () => {
  let database: DatabaseDependencies;
  let server: Server;
  let games: GameService;
  const adminId = randomUUID();
  const packId = randomUUID();
  let roomId: string;

  beforeAll(async () => {
    const config = loadConfig({
      APP_ENV: "test",
      DATABASE_URL: connectionString!,
      PARTICIPANT_SESSION_TOKEN_PEPPER: "public-contract-client-pepper-32-characters",
      HTTP_RATE_LIMIT_MAX_REQUESTS: "1000",
    });
    database = createDatabase(config);
    const rooms = new RoomService(database.db, config);
    games = new GameService(database.db);
    await database.db
      .insertInto("app.admin_users")
      .values({
        id: adminId,
        email: `${adminId}@contract.test`,
        password_hash: "test-only",
        status: "active",
        last_login_at: null,
      })
      .execute();
    await database.db
      .insertInto("app.task_packs")
      .values({
        id: packId,
        created_by_admin_id: adminId,
        slug: `contract-${packId}`,
        name: "Contract test tasks",
        description: null,
        status: "published",
        published_at: new Date(),
      })
      .execute();
    await database.db
      .insertInto("app.task_pack_items")
      .values(
        Array.from({ length: 10 }, (_, index) => ({
          id: randomUUID(),
          task_pack_id: packId,
          position: index + 1,
          description: `Public task ${index + 1}`,
          is_active: true,
        })),
      )
      .execute();
    const handler = createApiHandler({
      config,
      database: database.db,
      logger: pino({ enabled: false }),
      metrics: new InMemoryMetrics(),
      rooms,
      games,
    });
    server = createServer((incoming, outgoing) => void handler(incoming, outgoing));
  });

  afterAll(async () => {
    if (roomId) await database.db.deleteFrom("app.rooms").where("id", "=", roomId).execute();
    await database.db.deleteFrom("app.task_packs").where("id", "=", packId).execute();
    await database.db.deleteFrom("app.admin_users").where("id", "=", adminId).execute();
    await closeDatabase(database);
  });

  it("creates, joins, starts, kills, votes, and reaches a terminal winner over HTTP", async () => {
    const created = await request(server)
      .post("/api/v1/rooms")
      .set("Idempotency-Key", randomUUID())
      .send({ nickname: "Native Host" })
      .expect(201);
    const hostIssue = (created.body as unknown as { data: SessionIssue }).data;
    roomId = hostIssue.room.id;
    const issues = [hostIssue];
    for (let index = 1; index < 4; index += 1) {
      const joined = await request(server)
        .post(`/api/v1/rooms/${hostIssue.room.code}/participants`)
        .set("Idempotency-Key", randomUUID())
        .send({ nickname: `Native ${index}` })
        .expect(201);
      issues.push((joined.body as unknown as { data: SessionIssue }).data);
    }
    const clients = issues.map(
      (issue) =>
        new NativeContractClient(server, issue.sessionToken, issue.participant.participantId),
    );
    await request(server)
      .patch("/api/v1/rooms/current/settings")
      .set("Authorization", `Bearer ${hostIssue.sessionToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({ selectedTaskPackId: packId })
      .expect(200);
    await request(server)
      .post("/api/v1/rooms/current/start")
      .set("Authorization", `Bearer ${hostIssue.sessionToken}`)
      .set("Idempotency-Key", randomUUID())
      .send({})
      .expect(201);

    const snapshots = await Promise.all(clients.map((client) => client.snapshot()));
    const imposterIndex = snapshots.findIndex((snapshot) => snapshot.self.role === "imposter");
    const targetIndex = snapshots.findIndex((snapshot) => snapshot.self.role === "crew");
    const imposter = clients[imposterIndex];
    const target = clients[targetIndex];
    await imposter.kill(snapshots[imposterIndex].stateVersion, target.participantId);
    const caller = clients.find((client) => client !== imposter && client !== target)!;
    const game = await caller.snapshot();
    const assignment = await database.db
      .selectFrom("app.task_assignments")
      .select("id")
      .where("game_id", "=", game.id)
      .where("participant_id", "=", caller.participantId)
      .executeTakeFirstOrThrow();
    await database.db
      .updateTable("app.task_assignments")
      .set({ status: "completed", completed_at: new Date() })
      .where("id", "=", assignment.id)
      .execute();
    await caller.callMeeting(game.stateVersion);

    let terminal: VoteAcknowledgement | null = null;
    for (const client of clients.filter((candidate) => candidate !== target)) {
      const snapshot = await client.snapshot();
      terminal = await client.vote(
        snapshot.meeting!.id,
        snapshot.stateVersion,
        imposter.participantId,
      );
    }
    expect(terminal).toMatchObject({ resolved: true, winner: "crew" });
  });
});
