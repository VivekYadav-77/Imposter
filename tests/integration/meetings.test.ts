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

describeWithDatabase("meetings and terminal outcomes", () => {
  let dependencies: DatabaseDependencies;
  let rooms: RoomService;
  let games: GameService;
  const roomIds: string[] = [];
  const adminId = randomUUID();
  const packId = randomUUID();

  beforeAll(async () => {
    const config = loadConfig({
      APP_ENV: "test",
      DATABASE_URL: connectionString!,
      PARTICIPANT_SESSION_TOKEN_PEPPER: "meeting-participant-pepper-32-characters",
    });
    dependencies = createDatabase(config);
    rooms = new RoomService(dependencies.db, config);
    games = new GameService(dependencies.db);
    await dependencies.db
      .insertInto("app.admin_users")
      .values({
        id: adminId,
        email: `${adminId}@meetings.test`,
        password_hash: "test",
        status: "active",
        last_login_at: null,
      })
      .execute();
    await dependencies.db
      .insertInto("app.task_packs")
      .values({
        id: packId,
        created_by_admin_id: adminId,
        slug: `meetings-${packId}`,
        name: "Meeting tasks",
        description: null,
        status: "published",
        published_at: new Date(),
      })
      .execute();
    await dependencies.db
      .insertInto("app.task_pack_items")
      .values(
        Array.from({ length: 4 }, (_, index) => ({
          id: randomUUID(),
          task_pack_id: packId,
          position: index + 1,
          description: `Meeting task ${index + 1}`,
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

  it("runs an anonymous kill meeting through a crew ejection victory", async () => {
    const issued = [
      await rooms.createRoom({ nickname: "Host" }, randomUUID(), `meeting:${randomUUID()}`),
    ];
    roomIds.push(issued[0].room.id);
    for (let index = 1; index < 4; index += 1)
      issued.push(
        await rooms.joinRoom(
          issued[0].room.code,
          { nickname: `Player ${index}` },
          randomUUID(),
          `meeting:${randomUUID()}`,
        ),
      );
    const principals = await Promise.all(
      issued.map(async (entry) => (await rooms.authenticate(entry.sessionToken))!),
    );
    await rooms.updateSettings(principals[0], { selectedTaskPackId: packId }, randomUUID());
    await games.start(principals[0], randomUUID());
    const snapshots = await Promise.all(principals.map((principal) => games.snapshot(principal)));
    const imposterIndex = snapshots.findIndex((snapshot) => snapshot.self.role === "imposter");
    const targetIndex = snapshots.findIndex((snapshot) => snapshot.self.role === "crew");
    const imposter = principals[imposterIndex];
    const target = principals[targetIndex];
    const key = randomUUID();
    const killed = await games.kill(
      imposter,
      {
        expectedStateVersion: snapshots[imposterIndex].stateVersion,
        targetParticipantId: target.participantId,
      },
      key,
    );
    expect(killed).toMatchObject({ phase: "discussion", meeting: { triggerType: "kill" } });
    expect(JSON.stringify(await games.snapshot(principals[(imposterIndex + 1) % 4]))).not.toContain(
      '"triggerActorParticipantId"',
    );
    expect(
      await games.kill(
        imposter,
        {
          expectedStateVersion: snapshots[imposterIndex].stateVersion,
          targetParticipantId: target.participantId,
        },
        key,
      ),
    ).toEqual(killed);

    await dependencies.db
      .updateTable("app.games")
      .set({ phase_deadline_at: new Date(0) })
      .where("id", "=", killed.id)
      .execute();
    expect(await games.runDueTransitions()).toBe(1);
    const voting = await games.snapshot(imposter);
    expect(voting.phase).toBe("voting");
    await expect(
      games.ejectionVote(
        target,
        voting.meeting!.id,
        { expectedStateVersion: voting.stateVersion, targetParticipantId: imposter.participantId },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "PLAYER_NOT_ELIGIBLE" });

    const living = principals.filter(
      (principal) => principal.participantId !== target.participantId,
    );
    for (const voter of living) {
      const current = await games.snapshot(voter);
      await games.ejectionVote(
        voter,
        current.meeting!.id,
        {
          expectedStateVersion: current.stateVersion,
          targetParticipantId: imposter.participantId,
        },
        randomUUID(),
      );
    }
    const terminal = await games.snapshot(target);
    expect(terminal).toMatchObject({ phase: "game_over", winner: "crew" });
    expect(terminal.meeting?.result?.ejectedParticipantId).toBe(imposter.participantId);
  });

  it("resumes after a skipped meeting and resolves imposter parity on the next kill", async () => {
    const issued = [
      await rooms.createRoom({ nickname: "Parity Host" }, randomUUID(), `parity:${randomUUID()}`),
    ];
    roomIds.push(issued[0].room.id);
    for (let index = 1; index < 4; index += 1)
      issued.push(
        await rooms.joinRoom(
          issued[0].room.code,
          { nickname: `Parity ${index}` },
          randomUUID(),
          `parity:${randomUUID()}`,
        ),
      );
    const principals = await Promise.all(
      issued.map(async (entry) => (await rooms.authenticate(entry.sessionToken))!),
    );
    await rooms.updateSettings(principals[0], { selectedTaskPackId: packId }, randomUUID());
    await games.start(principals[0], randomUUID());
    const initial = await Promise.all(principals.map((principal) => games.snapshot(principal)));
    const imposter = principals[initial.findIndex((snapshot) => snapshot.self.role === "imposter")];
    const crew = principals.filter(
      (principal) => principal.participantId !== imposter.participantId,
    );
    const first = await games.kill(
      imposter,
      {
        expectedStateVersion: initial.find((snapshot) => snapshot.self.role === "imposter")!
          .stateVersion,
        targetParticipantId: crew[0].participantId,
      },
      randomUUID(),
    );
    await dependencies.db
      .updateTable("app.games")
      .set({ phase_deadline_at: new Date(0) })
      .where("id", "=", first.id)
      .execute();
    await games.runDueTransitions();
    const living = principals.filter(
      (principal) => principal.participantId !== crew[0].participantId,
    );
    for (const voter of living) {
      const current = await games.snapshot(voter);
      await games.ejectionVote(
        voter,
        current.meeting!.id,
        { expectedStateVersion: current.stateVersion, targetParticipantId: null },
        randomUUID(),
      );
    }
    const result = await games.snapshot(imposter);
    expect(result).toMatchObject({ phase: "result", winner: null });
    await dependencies.db
      .updateTable("app.games")
      .set({ phase_deadline_at: new Date(0) })
      .where("id", "=", first.id)
      .execute();
    await games.runDueTransitions();
    const task = await games.snapshot(imposter);
    expect(task.phase).toBe("task");
    await expect(
      games.kill(
        imposter,
        { expectedStateVersion: task.stateVersion, targetParticipantId: crew[1].participantId },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "KILL_COOLDOWN" });
    await dependencies.db
      .updateTable("app.game_participants")
      .set({ kill_available_at: new Date(0) })
      .where("game_id", "=", task.id)
      .where("participant_id", "=", imposter.participantId)
      .execute();
    const terminal = await games.kill(
      imposter,
      { expectedStateVersion: task.stateVersion, targetParticipantId: crew[1].participantId },
      randomUUID(),
    );
    expect(terminal).toMatchObject({ phase: "game_over", winner: "imposters" });
  });
});
