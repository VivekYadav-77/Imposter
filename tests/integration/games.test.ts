import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadConfig } from "../../src/infrastructure/configuration/config.js";
import {
  closeDatabase,
  createDatabase,
  type DatabaseDependencies,
} from "../../src/infrastructure/database/database.js";
import { GameService } from "../../src/modules/games/service.js";
import { RoomService } from "../../src/modules/rooms/service.js";

const connectionString = process.env.TEST_DATABASE_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;

describeWithDatabase("authoritative game start and progress", () => {
  let dependencies: DatabaseDependencies;
  let rooms: RoomService;
  let games: GameService;
  const adminId = randomUUID();
  const packId = randomUUID();
  const roomIds: string[] = [];

  beforeAll(async () => {
    const config = loadConfig({
      APP_ENV: "test",
      DATABASE_URL: connectionString!,
      PARTICIPANT_SESSION_TOKEN_PEPPER: "integration-participant-pepper-32-characters",
    });
    dependencies = createDatabase(config);
    rooms = new RoomService(dependencies.db, config);
    games = new GameService(dependencies.db, config);
    await dependencies.db
      .insertInto("app.admin_users")
      .values({
        id: adminId,
        email: `${adminId}@example.test`,
        password_hash: "test-only",
        status: "active",
        last_login_at: null,
      })
      .execute();
    await dependencies.db
      .insertInto("app.task_packs")
      .values({
        id: packId,
        created_by_admin_id: adminId,
        slug: `game-${packId}`,
        name: "Integration tasks",
        description: null,
        status: "published",
        published_at: new Date(),
      })
      .execute();
    await dependencies.db
      .insertInto("app.task_pack_items")
      .values(
        Array.from({ length: 10 }, (_, index) => ({
          id: randomUUID(),
          task_pack_id: packId,
          position: index + 1,
          description: `Do integration task ${index + 1}`,
          is_active: true,
        })),
      )
      .execute();
  });

  afterAll(async () => {
    if (roomIds.length)
      await dependencies.db.deleteFrom("app.rooms").where("id", "in", roomIds).execute();
    await dependencies.db.deleteFrom("app.task_packs").where("id", "=", packId).execute();
    await dependencies.db.deleteFrom("app.admin_users").where("id", "=", adminId).execute();
    await closeDatabase(dependencies);
  });

  async function readyRoom(count: number) {
    const issued = [
      await rooms.createRoom({ nickname: "Host" }, randomUUID(), `game:${randomUUID()}`),
    ];
    roomIds.push(issued[0].room.id);
    for (let index = 1; index < count; index += 1)
      issued.push(
        await rooms.joinRoom(
          issued[0].room.code,
          { nickname: `Player ${index}` },
          randomUUID(),
          `game:${randomUUID()}`,
        ),
      );
    const host = (await rooms.authenticate(issued[0].sessionToken))!;
    await rooms.updateSettings(host, { selectedTaskPackId: packId }, randomUUID());
    return {
      host,
      principals: await Promise.all(
        issued.map(async (entry) => (await rooms.authenticate(entry.sessionToken))!),
      ),
    };
  }

  it("serializes concurrent starts and persists fixed distributions", async () => {
    const ready = await readyRoom(8);
    const starts = await Promise.allSettled([
      games.start(ready.host, randomUUID()),
      games.start(ready.host, randomUUID()),
    ]);
    expect(starts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(starts.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "GAME_ALREADY_STARTED" },
    });
    const snapshot = await games.snapshot(ready.host);
    expect(snapshot.assignments).toHaveLength(4);
    const persistedRoles = await dependencies.db
      .selectFrom("app.game_participants")
      .select(["role"])
      .where("game_id", "=", snapshot.id)
      .execute();
    expect(persistedRoles.filter((entry) => entry.role === "imposter")).toHaveLength(2);
  });

  it("rejects a lobby that is missing players and a selected pack", async () => {
    const created = await rooms.createRoom(
      { nickname: "Unready Host" },
      randomUUID(),
      `game:${randomUUID()}`,
    );
    roomIds.push(created.room.id);
    const host = (await rooms.authenticate(created.sessionToken))!;
    const error = await games.start(host, randomUUID()).then(
      () => null,
      (reason: unknown) => reason,
    );
    expect(error).toMatchObject({ code: "ROOM_NOT_READY" });
    const details = (error as { details: { reasons: Record<string, unknown> } }).details;
    expect(typeof details.reasons.playerCount).toBe("string");
    expect(typeof details.reasons.selectedTaskPack).toBe("string");
  });

  it("projects only self secrets and reaches crew task victory through the test adapter", async () => {
    const ready = await readyRoom(4);
    let snapshot = await games.start(ready.host, randomUUID());
    for (const principal of ready.principals) {
      const projected = await games.snapshot(principal);
      const serialized = JSON.stringify(projected);
      expect(serialized).not.toContain("counts_toward_progress");
      expect(serialized).not.toContain("kill_available_at");
      expect(serialized).not.toContain("source_pack_item_id");
      expect(projected.assignments).toHaveLength(3);
    }

    const realAssignments = await dependencies.db
      .selectFrom("app.task_assignments")
      .select(["id", "participant_id"])
      .where("game_id", "=", snapshot.id)
      .where("counts_toward_progress", "=", true)
      .orderBy("id")
      .execute();
    const principalById = new Map(ready.principals.map((entry) => [entry.participantId, entry]));
    for (const assignment of realAssignments) {
      snapshot = await games.completeDevelopmentTask(
        principalById.get(assignment.participant_id)!,
        assignment.id,
        { expectedStateVersion: snapshot.stateVersion },
        randomUUID(),
      );
    }
    expect(snapshot).toMatchObject({ phase: "game_over", winner: "crew" });
  });
});
