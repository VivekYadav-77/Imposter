import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../../src/infrastructure/configuration/config.js";
import {
  closeDatabase,
  createDatabase,
  type DatabaseDependencies,
} from "../../src/infrastructure/database/database.js";
import { RoomService } from "../../src/modules/rooms/service.js";
import { UserAuthService } from "../../src/modules/user-auth/service.js";

const connectionString = process.env.TEST_DATABASE_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;

describeWithDatabase("optional player accounts", () => {
  let dependencies: DatabaseDependencies;
  let users: UserAuthService;
  let rooms: RoomService;
  const accountIds: string[] = [];
  const roomIds: string[] = [];

  beforeAll(() => {
    const config = loadConfig({
      APP_ENV: "test",
      DATABASE_URL: connectionString!,
      PARTICIPANT_SESSION_TOKEN_PEPPER: "integration-participant-pepper-32-characters",
      USER_SESSION_TOKEN_PEPPER: "integration-user-session-pepper-32-characters",
    });
    dependencies = createDatabase(config);
    users = new UserAuthService(dependencies.db, config);
    rooms = new RoomService(dependencies.db, config);
  });

  afterAll(async () => {
    if (roomIds.length)
      await dependencies.db.deleteFrom("app.rooms").where("id", "in", roomIds).execute();
    if (accountIds.length)
      await dependencies.db.deleteFrom("app.user_accounts").where("id", "in", accountIds).execute();
    await closeDatabase(dependencies);
  });

  it("registers, authenticates, claims a guest, and revokes device sessions", async () => {
    const suffix = randomUUID();
    const guest = await rooms.createRoom(
      { nickname: "Account player" },
      `create-${suffix}`,
      `scope-${suffix}`,
    );
    roomIds.push(guest.room.id);
    const created = await users.register(
      {
        email: `${suffix}@example.com`,
        password: "correct horse battery",
        displayName: "Account player",
        avatarId: "fox",
      },
      { ip: "127.0.0.1", userAgent: "Vitest browser" },
    );
    accountIds.push(created.user.id);
    const principal = await users.authenticate(created.session.token);
    expect(principal).toMatchObject({ userId: created.user.id });
    expect(await users.claimParticipant(principal!, guest.participant.participantId)).toBe(
      "linked",
    );
    expect((await users.dashboard(principal!)).rooms[0]).toMatchObject({
      roomId: guest.room.id,
      rejoinable: true,
    });
    const second = await users.login(
      { email: `${suffix}@example.com`, password: "correct horse battery" },
      { ip: "127.0.0.2", userAgent: "Second device" },
    );
    expect(await users.sessions(principal!)).toHaveLength(2);
    await users.revokeOthers(principal!);
    expect(await users.authenticate(second.session.token)).toBeNull();
  });
});
