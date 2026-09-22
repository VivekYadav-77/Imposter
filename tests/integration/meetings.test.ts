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

  it("keeps a kill private until an eligible player manually calls a meeting", async () => {
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
    expect(killed).toMatchObject({ phase: "task", meeting: null });
    const observer = principals.find(
      (principal) =>
        principal.participantId !== imposter.participantId &&
        principal.participantId !== target.participantId,
    )!;
    expect(
      (await games.snapshot(observer)).participants.find(
        (participant) => participant.id === target.participantId,
      )?.lifeStatus,
    ).toBe("alive");
    expect((await games.snapshot(target)).self.lifeStatus).toBe("killed");
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
      .updateTable("app.task_assignments")
      .set({ status: "completed", completed_at: new Date() })
      .where("game_id", "=", killed.id)
      .where("participant_id", "=", observer.participantId)
      .where("id", "=", (query) =>
        query
          .selectFrom("app.task_assignments")
          .select("id")
          .where("game_id", "=", killed.id)
          .where("participant_id", "=", observer.participantId)
          .limit(1),
      )
      .execute();
    const beforeMeeting = await games.snapshot(observer);
    const voting = await games.callMeeting(
      observer,
      { expectedStateVersion: beforeMeeting.stateVersion },
      randomUUID(),
    );
    expect(voting).toMatchObject({ phase: "voting", meeting: { triggerType: "user_called" } });
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
    expect(terminal).toMatchObject({
      phase: "game_over",
      winner: "crew",
      endReason: "imposters_ejected",
    });
    expect(terminal.resultSummary).not.toBeNull();
    expect(terminal.resultSummary?.players.some((player) => player.role === "imposter")).toBe(true);
    expect(terminal.resultSummary?.players.some((player) => player.role === "crew")).toBe(true);
    expect(terminal.meeting?.result?.ejectedParticipantId).toBe(imposter.participantId);
    expect(terminal.meeting?.publicVotes).toEqual([]);

    const leavingPrincipal = await rooms.authenticate(issued[1].sessionToken);
    expect(leavingPrincipal).not.toBeNull();
    await expect(rooms.leave(leavingPrincipal!, randomUUID())).resolves.toEqual({ left: true });
    const terminalHost = await rooms.authenticate(issued[0].sessionToken);
    expect(terminalHost).not.toBeNull();
    const replayed = await rooms.replayRoom(terminalHost!, randomUUID());
    expect(replayed).toMatchObject({ status: "lobby", gameId: null });
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
    await rooms.updateSettings(
      principals[0],
      { selectedTaskPackId: packId, voteVisibility: "public" },
      randomUUID(),
    );
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
    const caller = crew[1];
    const assignment = await dependencies.db
      .selectFrom("app.task_assignments")
      .select("id")
      .where("game_id", "=", first.id)
      .where("participant_id", "=", caller.participantId)
      .executeTakeFirstOrThrow();
    await dependencies.db
      .updateTable("app.task_assignments")
      .set({ status: "completed", completed_at: new Date() })
      .where("id", "=", assignment.id)
      .execute();
    const ready = await games.snapshot(caller);
    await games.callMeeting(caller, { expectedStateVersion: ready.stateVersion }, randomUUID());
    const living = principals.filter(
      (principal) => principal.participantId !== crew[0].participantId,
    );
    for (const [index, voter] of living.entries()) {
      const current = await games.snapshot(voter);
      await games.ejectionVote(
        voter,
        current.meeting!.id,
        { expectedStateVersion: current.stateVersion, targetParticipantId: null },
        randomUUID(),
      );
      if (index === 0) {
        const afterVote = await games.snapshot(voter);
        expect(afterVote.meeting?.publicVotes).toEqual([
          expect.objectContaining({
            voterParticipantId: voter.participantId,
            targetParticipantId: null,
          }),
        ]);
        await expect(
          games.ejectionVote(
            voter,
            afterVote.meeting!.id,
            {
              expectedStateVersion: afterVote.stateVersion,
              targetParticipantId: imposter.participantId,
            },
            randomUUID(),
          ),
        ).rejects.toMatchObject({ code: "VOTE_ALREADY_CAST" });
      }
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

  it("times out all-voted meetings and recovers legacy meetings with no deadline", async () => {
    const issued = [
      await rooms.createRoom(
        { nickname: "Deadline Host" },
        randomUUID(),
        `deadline:${randomUUID()}`,
      ),
    ];
    roomIds.push(issued[0].room.id);
    for (let index = 1; index < 5; index += 1)
      issued.push(
        await rooms.joinRoom(
          issued[0].room.code,
          { nickname: `Deadline ${index}` },
          randomUUID(),
          `deadline:${randomUUID()}`,
        ),
      );
    const principals = await Promise.all(
      issued.map(async (entry) => (await rooms.authenticate(entry.sessionToken))!),
    );
    await rooms.updateSettings(
      principals[0],
      {
        selectedTaskPackId: packId,
        meetingVotingMode: "all_voted",
        meetingDurationSeconds: 30,
      },
      randomUUID(),
    );
    const started = await games.start(principals[0], randomUUID());
    const assignment = await dependencies.db
      .selectFrom("app.task_assignments")
      .select("id")
      .where("game_id", "=", started.id)
      .where("participant_id", "=", principals[0].participantId)
      .executeTakeFirstOrThrow();
    await dependencies.db
      .updateTable("app.task_assignments")
      .set({ status: "completed", completed_at: new Date() })
      .where("id", "=", assignment.id)
      .execute();
    const ready = await games.snapshot(principals[0]);
    const voting = await games.callMeeting(
      principals[0],
      { expectedStateVersion: ready.stateVersion },
      randomUUID(),
    );
    expect(voting).toMatchObject({ phase: "voting", meeting: { votesCast: 0 } });
    expect(voting.phaseDeadlineAt).not.toBeNull();
    expect(voting.meeting?.deadlineAt).not.toBeNull();

    for (const voter of principals.slice(0, 4)) {
      const current = await games.snapshot(voter);
      await games.ejectionVote(
        voter,
        current.meeting!.id,
        { expectedStateVersion: current.stateVersion, targetParticipantId: null },
        randomUUID(),
      );
    }
    expect((await games.snapshot(principals[0])).phase).toBe("voting");

    // Simulate a meeting created by the previous all-voted implementation.
    await dependencies.db
      .updateTable("app.games")
      .set({ phase_deadline_at: null })
      .where("id", "=", started.id)
      .execute();
    await dependencies.db
      .updateTable("app.meetings")
      .set({ deadline_at: null })
      .where("id", "=", voting.meeting!.id)
      .execute();
    expect(await games.runDueTransitions()).toBeGreaterThan(0);
    const resolved = await games.snapshot(principals[4]);
    expect(resolved).toMatchObject({
      phase: "result",
      meeting: { phase: "resolved", votesCast: 4 },
    });
  });

  it("resolves wait-for-everyone voting when an unvoted player stays disconnected", async () => {
    const issued = [
      await rooms.createRoom({ nickname: "Quorum Host" }, randomUUID(), `quorum:${randomUUID()}`),
    ];
    roomIds.push(issued[0].room.id);
    for (let index = 1; index < 5; index += 1)
      issued.push(
        await rooms.joinRoom(
          issued[0].room.code,
          { nickname: `Quorum ${index}` },
          randomUUID(),
          `quorum:${randomUUID()}`,
        ),
      );
    const principals = await Promise.all(
      issued.map(async (entry) => (await rooms.authenticate(entry.sessionToken))!),
    );
    await rooms.updateSettings(
      principals[0],
      { selectedTaskPackId: packId, meetingVotingMode: "all_voted" },
      randomUUID(),
    );
    const started = await games.start(principals[0], randomUUID());
    const assignment = await dependencies.db
      .selectFrom("app.task_assignments")
      .select("id")
      .where("game_id", "=", started.id)
      .where("participant_id", "=", principals[0].participantId)
      .executeTakeFirstOrThrow();
    await dependencies.db
      .updateTable("app.task_assignments")
      .set({ status: "completed", completed_at: new Date() })
      .where("id", "=", assignment.id)
      .execute();
    const ready = await games.snapshot(principals[0]);
    const voting = await games.callMeeting(
      principals[0],
      { expectedStateVersion: ready.stateVersion },
      randomUUID(),
    );
    expect(voting.meeting).toMatchObject({ votesCast: 0, requiredVotes: 5 });

    for (const voter of principals.slice(0, 4)) {
      const current = await games.snapshot(voter);
      await games.ejectionVote(
        voter,
        current.meeting!.id,
        { expectedStateVersion: current.stateVersion, targetParticipantId: null },
        randomUUID(),
      );
    }
    expect((await games.snapshot(principals[0])).phase).toBe("voting");

    const absent = principals[4];
    await rooms.markDisconnected(absent);
    await games.handleParticipantDisconnected(absent.roomId, absent.participantId);

    expect(await games.snapshot(principals[0])).toMatchObject({
      phase: "result",
      meeting: { phase: "resolved", votesCast: 4 },
    });
  });
});
