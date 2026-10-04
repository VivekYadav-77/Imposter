import { randomUUID } from "node:crypto";
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
  const runId = randomUUID();
  const unique = (value: string) => `${value}:${runId}`;

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
      unique("create-capacity"),
      unique("test:capacity"),
    );
    createdRoomIds.push(created.room.id);
    await expect(
      rooms.joinRoom(
        created.room.code,
        { nickname: "  HOST " },
        unique("duplicate-host"),
        unique("test:duplicate-host"),
      ),
    ).rejects.toMatchObject({ code: "NICKNAME_TAKEN" });
    const race = await Promise.allSettled([
      rooms.joinRoom(
        created.room.code,
        { nickname: "  ALICE " },
        unique("race-alice-1"),
        unique("test:race-1"),
      ),
      rooms.joinRoom(
        created.room.code,
        { nickname: "alice" },
        unique("race-alice-2"),
        unique("test:race-2"),
      ),
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
          unique(`capacity-${index}`),
          unique(`test:capacity-${index}`),
        ),
      ),
    );
    const snapshot = await rooms.snapshot((await rooms.authenticate(created.sessionToken))!);
    expect(snapshot.participants).toHaveLength(15);
    expect(joins.filter((result) => result.status === "fulfilled")).toHaveLength(13);
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
      unique("create-lifecycle"),
      unique("test:lifecycle"),
    );
    createdRoomIds.push(created.room.id);
    const second = await rooms.joinRoom(
      created.room.code,
      { nickname: "Second" },
      unique("join-second"),
      unique("test:lifecycle-second"),
    );
    const host = (await rooms.authenticate(created.sessionToken))!;
    const rotated = await rooms.rotate(host, unique("rotate-host"));
    expect(await rooms.authenticate(rotated.sessionToken)).toMatchObject({
      participantId: host.participantId,
      roomId: host.roomId,
    });
    await rooms.leave(host, unique("leave-host"));
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

  it("reserves avatars atomically and releases them only after leaving", async () => {
    const created = await rooms.createRoom(
      { nickname: "Avatar Host", avatarId: "fox", minPlayers: 3, maxPlayers: 5 },
      unique("create-avatars"),
      unique("test:avatars"),
    );
    createdRoomIds.push(created.room.id);
    const race = await Promise.allSettled([
      rooms.joinRoom(
        created.room.code,
        { nickname: "Owl One", avatarId: "owl" },
        unique("owl-one"),
        unique("test:owl-one"),
      ),
      rooms.joinRoom(
        created.room.code,
        { nickname: "Owl Two", avatarId: "owl" },
        unique("owl-two"),
        unique("test:owl-two"),
      ),
    ]);
    const fulfilled = race.find((result) => result.status === "fulfilled");
    expect(fulfilled?.status).toBe("fulfilled");
    expect(race.filter((result) => result.status === "rejected")).toHaveLength(1);
    const rejected = race.find((result) => result.status === "rejected");
    expect(rejected?.status).toBe("rejected");
    if (rejected?.status === "rejected") {
      const reason = rejected.reason as {
        code?: string;
        details?: { availableAvatarIds?: unknown[] };
      };
      expect(reason.code).toBe("AVATAR_TAKEN");
      expect(reason.details?.availableAvatarIds).toBeInstanceOf(Array);
    }
    expect(
      (await rooms.joinOptions(created.room.code, unique("test:avatar-options")))
        .availableAvatarIds,
    ).not.toContain("owl");

    if (fulfilled?.status === "fulfilled") {
      const principal = await rooms.authenticate(fulfilled.value.sessionToken);
      expect(principal).not.toBeNull();
      await rooms.leave(principal!, unique("leave-owl"));
    }
    expect(
      (await rooms.joinOptions(created.room.code, unique("test:avatar-released")))
        .availableAvatarIds,
    ).toContain("owl");
  });

  it("denies a principal projected into another room", async () => {
    const first = await rooms.createRoom(
      { nickname: "One" },
      unique("create-cross-1"),
      unique("test:cross-1"),
    );
    const second = await rooms.createRoom(
      { nickname: "Two" },
      unique("create-cross-2"),
      unique("test:cross-2"),
    );
    createdRoomIds.push(first.room.id, second.room.id);
    const principal = (await rooms.authenticate(first.sessionToken))!;
    await expect(rooms.snapshot({ ...principal, roomId: second.room.id })).rejects.toMatchObject({
      code: "SESSION_INVALID",
    });
  });
});
