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
import type {
  GoogleIdentity,
  GoogleIdentityProvider,
} from "../../src/modules/user-auth/google-oauth.js";

const connectionString = process.env.TEST_DATABASE_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;

describeWithDatabase("optional player accounts", () => {
  let dependencies: DatabaseDependencies;
  let users: UserAuthService;
  let rooms: RoomService;
  const accountIds: string[] = [];
  const roomIds: string[] = [];

  const googleIdentity: GoogleIdentity = {
    subject: "google-subject-1",
    email: "legacy@example.com",
    emailVerified: true,
    name: "Account player",
  };
  const google: GoogleIdentityProvider = {
    authorizationUrl: ({ state, nonce }) =>
      `https://accounts.example/auth?state=${state}&nonce=${nonce}`,
    exchange: () => Promise.resolve(googleIdentity),
  };

  beforeAll(() => {
    const config = loadConfig({
      APP_ENV: "test",
      DATABASE_URL: connectionString!,
      PARTICIPANT_SESSION_TOKEN_PEPPER: "integration-participant-pepper-32-characters",
      USER_SESSION_TOKEN_PEPPER: "integration-user-session-pepper-32-characters",
    });
    dependencies = createDatabase(config);
    users = new UserAuthService(dependencies.db, config, google);
    rooms = new RoomService(dependencies.db, config);
  });

  afterAll(async () => {
    if (roomIds.length)
      await dependencies.db.deleteFrom("app.rooms").where("id", "in", roomIds).execute();
    if (accountIds.length)
      await dependencies.db.deleteFrom("app.user_accounts").where("id", "in", accountIds).execute();
    await closeDatabase(dependencies);
  });

  it("links a verified Google identity, claims a guest, and revokes device sessions", async () => {
    const suffix = randomUUID();
    const guest = await rooms.createRoom(
      { nickname: "Account player" },
      `create-${suffix}`,
      `scope-${suffix}`,
    );
    roomIds.push(guest.room.id);
    const legacyAccountId = randomUUID();
    accountIds.push(legacyAccountId);
    await dependencies.db
      .insertInto("app.user_accounts")
      .values({
        id: legacyAccountId,
        email: googleIdentity.email,
        display_name: "Legacy player",
        default_avatar_id: "fox",
        password_hash: "inert-legacy-hash",
        status: "active",
        updated_at: new Date(),
      })
      .execute();
    const started = await users.beginGoogleAuth("login", guest.participant.participantId, null);
    await expect(
      users.completeGoogleAuth({
        state: started.state,
        cookieState: "wrong-browser-state",
        code: "authorization-code",
        meta: { ip: "127.0.0.1", userAgent: "Vitest browser" },
      }),
    ).rejects.toMatchObject({ code: "OAUTH_STATE_INVALID" });
    const created = await users.completeGoogleAuth({
      state: started.state,
      cookieState: started.state,
      code: "authorization-code",
      meta: { ip: "127.0.0.1", userAgent: "Vitest browser" },
    });
    expect(created.user.id).toBe(legacyAccountId);
    expect(created.participantId).toBe(guest.participant.participantId);
    await expect(
      users.completeGoogleAuth({
        state: started.state,
        cookieState: started.state,
        code: "replayed-code",
        meta: { ip: "127.0.0.1", userAgent: "Vitest browser" },
      }),
    ).rejects.toMatchObject({ code: "OAUTH_TRANSACTION_EXPIRED" });
    const principal = await users.authenticate(created.session!.token);
    expect(principal).toMatchObject({ userId: legacyAccountId });
    expect(await users.claimParticipant(principal!, guest.participant.participantId)).toBe(
      "linked",
    );
    expect((await users.dashboard(principal!)).rooms[0]).toMatchObject({
      roomId: guest.room.id,
      rejoinable: true,
    });
    const guestPrincipal = await rooms.authenticate(guest.sessionToken);
    await rooms.leave(guestPrincipal!, `leave-${suffix}`);
    const pastRoom = (await users.dashboard(principal!)).rooms.find(
      (room) => room.roomId === guest.room.id,
    );
    expect(pastRoom).toMatchObject({ status: "expired", rejoinable: true });
    const reopened = await rooms.rejoinForUser(
      principal!.userId,
      guest.participant.participantId,
      `reopen-${suffix}`,
    );
    expect(reopened.room).toMatchObject({ id: guest.room.id, status: "lobby" });
    expect(reopened.room.code).not.toBe(guest.room.code);
    expect(reopened.room.self).toMatchObject({
      participantId: guest.participant.participantId,
      isHost: true,
    });
    const secondStart = await users.beginGoogleAuth("login", null, null);
    const second = await users.completeGoogleAuth({
      state: secondStart.state,
      cookieState: secondStart.state,
      code: "second-code",
      meta: { ip: "127.0.0.2", userAgent: "Second device" },
    });
    expect(await users.sessions(principal!)).toHaveLength(2);
    await users.revokeOthers(principal!);
    expect(await users.authenticate(second.session!.token)).toBeNull();

    const deleteStart = await users.beginGoogleAuth("delete", null, principal);
    const reauthenticated = await users.completeGoogleAuth({
      state: deleteStart.state,
      cookieState: deleteStart.state,
      code: "reauth-code",
      meta: { ip: "127.0.0.1", userAgent: "Vitest browser" },
    });
    expect(reauthenticated.session).toBeNull();
    await users.deleteAccount(principal!);
    await expect(users.profile(principal!)).rejects.toBeTruthy();
  });
});
