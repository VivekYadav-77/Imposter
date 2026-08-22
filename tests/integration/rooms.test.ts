import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadConfig } from "../../src/infrastructure/configuration/config.js";
import {
  closeDatabase,
  createDatabase,
  type DatabaseDependencies,
} from "../../src/infrastructure/database/database.js";
import { RoomService } from "../../src/modules/rooms/service.js";

const connectionString = process.env.TEST_DATABASE_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;

describeWithDatabase("room and participant lifecycle persistence", () => {
  let dependencies: DatabaseDependencies;
  let rooms: RoomService;
  const createdRoomIds: string[] = [];

  beforeAll(() => {
    const config = loadConfig({
      APP_ENV: "test",
      DATABASE_URL: connectionString!,
      PARTICIPANT_SESSION_TOKEN_PEPPER: "integration-participant-pepper-32-characters",
      HOST_DISCONNECT_GRACE_SECONDS: "5",
    });
    dependencies = createDatabase(config);
    rooms = new RoomService(dependencies.db, config);
  });

  afterAll(async () => {
    if (createdRoomIds.length)
      await dependencies.db.deleteFrom("app.rooms").where("id", "in", createdRoomIds).execute();
    await closeDatabase(dependencies);
  });

  it("serializes nickname races and joins at fixed capacity", async () => {
    const created = await rooms.createRoom(
      { nickname: "Host" },
      "create-capacity",
      "test:capacity",
    );
    createdRoomIds.push(created.room.id);
    const race = await Promise.allSettled([
      rooms.joinRoom(created.room.code, { nickname: "  ALICE " }, "race-alice-1", "test:race-1"),
      rooms.joinRoom(created.room.code, { nickname: "alice" }, "race-alice-2", "test:race-2"),
    ]);
    expect(race.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(race.find((result) => result.status === "rejected")).toMatchObject({
      reason: { code: "NICKNAME_TAKEN" },
    });

    const joins = await Promise.allSettled(
      Array.from({ length: 15 }, (_, index) =>
        rooms.joinRoom(
          created.room.code,
          { nickname: `Player ${index}` },
          `capacity-${index}`,
          `test:capacity-${index}`,
        ),
      ),
    );
    const snapshot = await rooms.snapshot((await rooms.authenticate(created.sessionToken))!);
    expect(snapshot.participants).toHaveLength(12);
    expect(joins.filter((result) => result.status === "fulfilled")).toHaveLength(10);
    const rejectedCodes = joins.flatMap((result) => {
      if (result.status !== "rejected") return [];
      const reason = result.reason as { code?: unknown };
      return [reason.code];
    });
    expect(rejectedCodes.every((code) => code === "ROOM_FULL")).toBe(true);
  });

  it("rotates, revokes, transfers host deterministically, and expires from persisted deadlines", async () => {
    const created = await rooms.createRoom(
      { nickname: "Host" },
      "create-lifecycle",
      "test:lifecycle",
    );
    createdRoomIds.push(created.room.id);
    const second = await rooms.joinRoom(
      created.room.code,
      { nickname: "Second" },
      "join-second",
      "test:lifecycle-second",
    );
    const host = (await rooms.authenticate(created.sessionToken))!;
    const rotated = await rooms.rotate(host, "rotate-host");
    expect(await rooms.authenticate(rotated.sessionToken)).toMatchObject({
      participantId: host.participantId,
      roomId: host.roomId,
    });
    await rooms.leave(host, "leave-host");
    const secondPrincipal = (await rooms.authenticate(second.sessionToken))!;
    expect((await rooms.snapshot(secondPrincipal)).self.isHost).toBe(true);
    expect(await rooms.authenticate(rotated.sessionToken)).toBeNull();

    await dependencies.db
      .updateTable("app.rooms")
      .set({ expires_at: new Date(Date.now() - 1000) })
      .where("id", "=", created.room.id)
      .execute();
    await rooms.runMaintenance();
    expect(await rooms.authenticate(second.sessionToken)).toBeNull();
    const persisted = await dependencies.db
      .selectFrom("app.rooms")
      .select("status")
      .where("id", "=", created.room.id)
      .executeTakeFirstOrThrow();
    expect(persisted.status).toBe("expired");
  });

  it("denies a principal projected into another room", async () => {
    const first = await rooms.createRoom({ nickname: "One" }, "create-cross-1", "test:cross-1");
    const second = await rooms.createRoom({ nickname: "Two" }, "create-cross-2", "test:cross-2");
    createdRoomIds.push(first.room.id, second.room.id);
    const principal = (await rooms.authenticate(first.sessionToken))!;
    await expect(rooms.snapshot({ ...principal, roomId: second.room.id })).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
  });
});
