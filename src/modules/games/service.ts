import { createHash, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { sql, type Transaction } from "kysely";

import type { Database, DatabaseSchema } from "../../infrastructure/database/database.js";
import { inTransaction } from "../../infrastructure/database/transaction.js";
import type { ParticipantPrincipal } from "../rooms/types.js";
import { ApplicationError } from "../../shared/errors/application-error.js";
import {
  capabilitiesFor,
  determineWinner,
  playerBand,
  resolveEjection,
  resolveReview,
} from "./domain.js";
import { createAssignmentPlan } from "./random.js";
import type { EjectionVoteInput, KillInput, ReviewVoteInput } from "./schemas.js";
import type { GameSnapshotDto, MeetingDto } from "./types.js";

type Executor = Database | Transaction<DatabaseSchema>;

const RESULT_SECONDS = 10;
const KILL_COOLDOWN_SECONDS = 30;

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function requestHash(operation: string, body: unknown): string {
  return createHash("sha256").update(JSON.stringify({ operation, body })).digest("base64url");
}

export class GameEvents extends EventEmitter {
  gameChanged(roomId: string, gameId: string, stateVersion: number): void {
    this.emit("game.changed", { roomId, gameId, stateVersion });
  }
}

export class GameService {
  readonly events = new GameEvents();

  constructor(private readonly database: Database) {}

  private assertVersion(game: { state_version: string }, expectedStateVersion: number): void {
    if (Number(game.state_version) !== expectedStateVersion)
      throw new ApplicationError(409, "GAME_STATE_CONFLICT", "The game state has changed.", {
        currentStateVersion: Number(game.state_version),
      });
  }

  private async winnerWith(executor: Executor, gameId: string) {
    const [life, tasks] = await Promise.all([
      executor
        .selectFrom("app.game_participants")
        .select([
          sql<number>`count(*) filter (where role = 'crew' and life_status = 'alive')::int`.as(
            "livingCrew",
          ),
          sql<number>`count(*) filter (where role = 'imposter' and life_status = 'alive')::int`.as(
            "livingImposters",
          ),
        ])
        .where("game_id", "=", gameId)
        .executeTakeFirstOrThrow(),
      executor
        .selectFrom("app.task_assignments")
        .select([
          sql<number>`count(*)::int`.as("totalRealTasks"),
          sql<number>`count(*) filter (where status = 'completed')::int`.as("completedRealTasks"),
        ])
        .where("game_id", "=", gameId)
        .where("counts_toward_progress", "=", true)
        .executeTakeFirstOrThrow(),
    ]);
    return determineWinner({ ...life, ...tasks });
  }

  private async meetingWith(
    executor: Executor,
    gameId: string,
    participantId: string,
    gamePhase: string,
  ): Promise<MeetingDto | null> {
    if (gamePhase === "task" || gamePhase === "abandoned") return null;
    const meeting = await executor
      .selectFrom("app.meetings")
      .selectAll()
      .where("game_id", "=", gameId)
      .orderBy("sequence_number", "desc")
      .executeTakeFirst();
    if (!meeting) return null;
    const eligible = await executor
      .selectFrom("app.meeting_eligible_voters as eligible")
      .innerJoin("app.participants as participant", "participant.id", "eligible.participant_id")
      .select(["participant.id", "participant.nickname"])
      .where("eligible.meeting_id", "=", meeting.id)
      .orderBy("participant.joined_at")
      .orderBy("participant.id")
      .execute();
    const review =
      meeting.phase === "review"
        ? await executor
            .selectFrom("app.evidence_review_items as item")
            .innerJoin("app.task_submissions as submission", "submission.id", "item.submission_id")
            .innerJoin(
              "app.task_assignments as assignment",
              "assignment.id",
              "submission.assignment_id",
            )
            .innerJoin("app.game_tasks as task", "task.id", "assignment.game_task_id")
            .innerJoin(
              "app.participants as uploader",
              "uploader.id",
              "submission.uploader_participant_id",
            )
            .select([
              "item.id",
              "item.submission_id",
              "item.position",
              "uploader.id as uploader_id",
              "uploader.nickname as uploader_nickname",
              "task.description_snapshot",
            ])
            .where("item.meeting_id", "=", meeting.id)
            .where("item.resolution", "is", null)
            .orderBy("item.position")
            .executeTakeFirst()
        : null;
    const [reviewCount, ownReview, reviewVotes, ownEjection, ejectionVotes] = await Promise.all([
      executor
        .selectFrom("app.evidence_review_items")
        .select(sql<number>`count(*)::int`.as("count"))
        .where("meeting_id", "=", meeting.id)
        .executeTakeFirstOrThrow(),
      review
        ? executor
            .selectFrom("app.evidence_review_votes")
            .select("decision")
            .where("review_item_id", "=", review.id)
            .where("voter_participant_id", "=", participantId)
            .executeTakeFirst()
        : Promise.resolve(undefined),
      review
        ? executor
            .selectFrom("app.evidence_review_votes")
            .select(sql<number>`count(*)::int`.as("count"))
            .where("review_item_id", "=", review.id)
            .executeTakeFirstOrThrow()
        : Promise.resolve({ count: 0 }),
      executor
        .selectFrom("app.ejection_votes")
        .select("target_participant_id")
        .where("meeting_id", "=", meeting.id)
        .where("voter_participant_id", "=", participantId)
        .executeTakeFirst(),
      executor
        .selectFrom("app.ejection_votes")
        .select("target_participant_id")
        .where("meeting_id", "=", meeting.id)
        .execute(),
    ]);
    const eligibleSelf = eligible.some((entry) => entry.id === participantId);
    const result =
      meeting.phase === "resolved"
        ? resolveEjection(ejectionVotes.map((v) => v.target_participant_id))
        : null;
    return {
      id: meeting.id,
      sequenceNumber: meeting.sequence_number,
      triggerType: meeting.trigger_type,
      reportedParticipantId: meeting.reported_participant_id,
      phase: meeting.phase,
      deadlineAt: meeting.deadline_at ? iso(meeting.deadline_at) : null,
      eligibleParticipants: eligible,
      reviewItem: review
        ? {
            id: review.id,
            submissionId: review.submission_id,
            position: review.position,
            total: reviewCount.count,
            uploader: { id: review.uploader_id, nickname: review.uploader_nickname },
            assignmentDescription: review.description_snapshot,
            ownDecision: ownReview?.decision ?? null,
            votesCast: reviewVotes.count,
          }
        : null,
      ownEjectionTargetParticipantId: ownEjection?.target_participant_id ?? null,
      hasCastEjectionVote: Boolean(ownEjection),
      votesCast: ejectionVotes.length,
      result: result
        ? {
            ejectedParticipantId: meeting.ejected_participant_id,
            totals: Object.entries(result.totals).map(([participantId, votes]) => ({
              participantId,
              votes,
            })),
            skipVotes: result.skip,
          }
        : null,
      capabilities:
        eligibleSelf && meeting.phase === "review"
          ? ["vote_review"]
          : eligibleSelf && meeting.phase === "voting"
            ? ["vote_ejection"]
            : [],
    };
  }

  private async replay<T>(
    trx: Transaction<DatabaseSchema>,
    participantId: string,
    key: string,
    operation: string,
    body: unknown,
  ): Promise<T | null> {
    await sql`select pg_advisory_xact_lock(hashtextextended(${`game:${participantId}:${key}`}, 0))`.execute(
      trx,
    );
    const existing = await trx
      .selectFrom("app.game_idempotency_records")
      .select(["operation", "request_hash", "response_body", "expires_at"])
      .where("participant_id", "=", participantId)
      .where("key", "=", key)
      .executeTakeFirst();
    if (!existing) return null;
    if (new Date(existing.expires_at).getTime() <= Date.now()) {
      await trx
        .deleteFrom("app.game_idempotency_records")
        .where("participant_id", "=", participantId)
        .where("key", "=", key)
        .execute();
      return null;
    }
    if (existing.operation !== operation || existing.request_hash !== requestHash(operation, body))
      throw new ApplicationError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "The Idempotency-Key was already used for a different request.",
      );
    return existing.response_body as unknown as T;
  }

  private async remember(
    trx: Transaction<DatabaseSchema>,
    participantId: string,
    key: string,
    operation: string,
    body: unknown,
    response: unknown,
  ): Promise<void> {
    await trx
      .insertInto("app.game_idempotency_records")
      .values({
        participant_id: participantId,
        key,
        operation,
        request_hash: requestHash(operation, body),
        response_body: response as Record<string, unknown>,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .execute();
  }

  private async snapshotWith(
    executor: Executor,
    principal: ParticipantPrincipal,
  ): Promise<GameSnapshotDto> {
    const game = await executor
      .selectFrom("app.games as games")
      .innerJoin("app.game_participants as self", (join) =>
        join
          .onRef("self.game_id", "=", "games.id")
          .on("self.participant_id", "=", principal.participantId),
      )
      .innerJoin("app.rooms as rooms", "rooms.id", "games.room_id")
      .select([
        "games.id",
        "games.room_id",
        "games.phase",
        "games.state_version",
        "games.winner",
        "games.task_pack_name_snapshot",
        "games.phase_started_at",
        "games.phase_deadline_at",
        "rooms.host_participant_id",
        "self.role",
        "self.life_status",
      ])
      .where("games.room_id", "=", principal.roomId)
      .executeTakeFirst();
    if (!game) throw new ApplicationError(404, "GAME_NOT_FOUND", "No current game was found.");

    const [participants, assignments, progress, meeting] = await Promise.all([
      executor
        .selectFrom("app.game_participants as gp")
        .innerJoin("app.participants as participants", "participants.id", "gp.participant_id")
        .select(["participants.id", "participants.nickname", "gp.life_status"])
        .where("gp.game_id", "=", game.id)
        .orderBy("participants.joined_at")
        .orderBy("participants.id")
        .execute(),
      executor
        .selectFrom("app.task_assignments as assignments")
        .innerJoin("app.game_tasks as tasks", "tasks.id", "assignments.game_task_id")
        .select([
          "assignments.id",
          "assignments.status",
          "assignments.completed_at",
          "tasks.description_snapshot",
          "tasks.position",
        ])
        .where("assignments.game_id", "=", game.id)
        .where("assignments.participant_id", "=", principal.participantId)
        .orderBy("tasks.position")
        .execute(),
      executor
        .selectFrom("app.task_assignments")
        .select([
          sql<number>`count(*)::int`.as("total"),
          sql<number>`count(*) filter (where status = 'completed')::int`.as("completed"),
        ])
        .where("game_id", "=", game.id)
        .where("counts_toward_progress", "=", true)
        .executeTakeFirstOrThrow(),
      this.meetingWith(executor, game.id, principal.participantId, game.phase),
    ]);

    return {
      id: game.id,
      roomId: game.room_id,
      phase: game.phase,
      stateVersion: Number(game.state_version),
      winner: game.winner,
      taskPack: { name: game.task_pack_name_snapshot },
      phaseStartedAt: iso(game.phase_started_at),
      phaseDeadlineAt: game.phase_deadline_at ? iso(game.phase_deadline_at) : null,
      participants: participants.map((participant) => ({
        id: participant.id,
        nickname: participant.nickname,
        isHost: participant.id === game.host_participant_id,
        lifeStatus: participant.life_status,
      })),
      self: {
        participantId: principal.participantId,
        role: game.role,
        lifeStatus: game.life_status,
        capabilities: capabilitiesFor({
          phase: game.phase,
          role: game.role,
          lifeStatus: game.life_status,
          isHost: principal.participantId === game.host_participant_id,
          winner: game.winner,
        }),
      },
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        description: assignment.description_snapshot,
        status: assignment.status,
        completedAt: assignment.completed_at ? iso(assignment.completed_at) : null,
      })),
      progress: { completed: progress.completed, total: progress.total },
      meeting,
    };
  }

  snapshot(principal: ParticipantPrincipal): Promise<GameSnapshotDto> {
    return this.snapshotWith(this.database, principal);
  }

  async start(principal: ParticipantPrincipal, key: string): Promise<GameSnapshotDto> {
    const result = await inTransaction(this.database, async (trx) => {
      const operation = "game.start";
      const replayed = await this.replay<GameSnapshotDto>(
        trx,
        principal.participantId,
        key,
        operation,
        {},
      );
      if (replayed) return { snapshot: replayed, changed: false };
      const room = await trx
        .selectFrom("app.rooms")
        .selectAll()
        .where("id", "=", principal.roomId)
        .forUpdate()
        .executeTakeFirst();
      if (!room) throw new ApplicationError(404, "NOT_FOUND", "The room was not found.");
      if (room.host_participant_id !== principal.participantId)
        throw new ApplicationError(403, "FORBIDDEN", "Only the host can start the game.");
      if (room.status !== "lobby")
        throw new ApplicationError(409, "GAME_ALREADY_STARTED", "The game has already started.");

      const participants = await trx
        .selectFrom("app.participants")
        .select(["id", "joined_at"])
        .where("room_id", "=", room.id)
        .where("membership_status", "=", "joined")
        .orderBy("joined_at")
        .orderBy("id")
        .execute();
      const reasons: Record<string, string> = {};
      if (participants.length < 4 || participants.length > 12)
        reasons.playerCount = "Between 4 and 12 joined players are required.";
      if (!room.selected_task_pack_id) reasons.selectedTaskPack = "Select a published task pack.";
      const pack = room.selected_task_pack_id
        ? await trx
            .selectFrom("app.task_packs")
            .select(["id", "name", "status"])
            .where("id", "=", room.selected_task_pack_id)
            .executeTakeFirst()
        : null;
      if (room.selected_task_pack_id && (!pack || pack.status !== "published"))
        reasons.selectedTaskPack = "The selected task pack is not published.";
      const items = pack
        ? await trx
            .selectFrom("app.task_pack_items")
            .select(["id", "position", "description"])
            .where("task_pack_id", "=", pack.id)
            .where("is_active", "=", true)
            .orderBy("position")
            .execute()
        : [];
      const band =
        participants.length >= 4 && participants.length <= 12
          ? playerBand(participants.length)
          : null;
      if (band && items.length < band.tasksPerPlayer)
        reasons.selectedTaskPack = `The selected task pack needs at least ${band.tasksPerPlayer} active tasks.`;
      if (Object.keys(reasons).length || !pack || !band)
        throw new ApplicationError(422, "ROOM_NOT_READY", "The room is not ready to start.", {
          reasons,
        });

      const now = new Date();
      const gameId = randomUUID();
      const participantIds = participants.map((participant) => participant.id);
      await trx
        .insertInto("app.games")
        .values({
          id: gameId,
          room_id: room.id,
          source_task_pack_id: pack.id,
          task_pack_name_snapshot: pack.name,
          phase: "task",
          state_version: 1,
          winner: null,
          phase_started_at: now,
          phase_deadline_at: new Date(now.getTime() + room.task_phase_seconds * 1000),
          started_at: now,
          ended_at: null,
        })
        .execute();
      await trx
        .insertInto("app.game_participants")
        .values(
          participants.map((participant) => ({
            game_id: gameId,
            participant_id: participant.id,
            role: "crew" as const,
            life_status: "alive" as const,
            kill_available_at: null,
          })),
        )
        .execute();
      const snapshots = items.map((item) => ({
        id: randomUUID(),
        game_id: gameId,
        source_pack_item_id: item.id,
        description_snapshot: item.description,
        position: item.position,
      }));
      const plan = createAssignmentPlan(
        participantIds,
        snapshots,
        band.imposters,
        band.tasksPerPlayer,
      );
      await Promise.all(
        participantIds.map((participantId) =>
          trx
            .updateTable("app.game_participants")
            .set({
              role: plan.roles.get(participantId)!,
              kill_available_at: plan.roles.get(participantId) === "imposter" ? now : null,
            })
            .where("game_id", "=", gameId)
            .where("participant_id", "=", participantId)
            .execute(),
        ),
      );
      await trx.insertInto("app.game_tasks").values(snapshots).execute();
      await trx
        .insertInto("app.task_assignments")
        .values(
          participants.flatMap((participant) =>
            plan.tasks.get(participant.id)!.map((task) => ({
              id: randomUUID(),
              game_id: gameId,
              game_task_id: task.id,
              participant_id: participant.id,
              counts_toward_progress: plan.roles.get(participant.id) === "crew",
              status: "assigned" as const,
              completed_at: null,
            })),
          ),
        )
        .execute();
      await trx
        .insertInto("app.game_events")
        .values({
          game_id: gameId,
          state_version: 1,
          type: "game.started",
          actor_participant_id: principal.participantId,
          visibility: "public",
          payload: { schemaVersion: 1, playerCount: participants.length },
        })
        .execute();
      await trx
        .updateTable("app.rooms")
        .set({
          status: "active",
          imposter_count: band.imposters,
          tasks_per_crew: band.tasksPerPlayer,
          last_activity_at: now,
          expires_at: new Date(now.getTime() + 12 * 60 * 60 * 1000),
        })
        .where("id", "=", room.id)
        .execute();
      const snapshot = await this.snapshotWith(trx, principal);
      await this.remember(trx, principal.participantId, key, operation, {}, snapshot);
      return { snapshot, changed: true };
    });
    if (result.changed)
      this.events.gameChanged(principal.roomId, result.snapshot.id, result.snapshot.stateVersion);
    return result.snapshot;
  }

  private async createMeeting(
    trx: Transaction<DatabaseSchema>,
    game: { id: string; room_id: string },
    triggerType: "kill" | "task_deadline",
    actorParticipantId: string | null,
    reportedParticipantId: string | null,
    now: Date,
  ) {
    const room = await trx
      .selectFrom("app.rooms")
      .select(["discussion_seconds"])
      .where("id", "=", game.room_id)
      .executeTakeFirstOrThrow();
    const previous = await trx
      .selectFrom("app.meetings")
      .select(sql<number>`coalesce(max(sequence_number), 0)::int`.as("sequence"))
      .where("game_id", "=", game.id)
      .executeTakeFirstOrThrow();
    const meetingId = randomUUID();
    const deadline = new Date(now.getTime() + room.discussion_seconds * 1000);
    await trx
      .insertInto("app.meetings")
      .values({
        id: meetingId,
        game_id: game.id,
        sequence_number: previous.sequence + 1,
        trigger_type: triggerType,
        trigger_actor_participant_id: actorParticipantId,
        reported_participant_id: reportedParticipantId,
        phase: "discussion",
        deadline_at: deadline,
        ejected_participant_id: null,
        resolved_at: null,
      })
      .execute();
    const voters = await trx
      .selectFrom("app.game_participants")
      .select("participant_id")
      .where("game_id", "=", game.id)
      .where("life_status", "=", "alive")
      .execute();
    if (voters.length)
      await trx
        .insertInto("app.meeting_eligible_voters")
        .values(
          voters.map((voter) => ({ meeting_id: meetingId, participant_id: voter.participant_id })),
        )
        .execute();
    const flagged = await trx
      .selectFrom("app.task_submissions as submission")
      .innerJoin("app.task_assignments as assignment", "assignment.id", "submission.assignment_id")
      .innerJoin("app.submission_flags as flag", "flag.submission_id", "submission.id")
      .select("submission.id")
      .distinct()
      .where("assignment.game_id", "=", game.id)
      .where("submission.processing_status", "=", "accepted")
      .where("submission.review_status", "=", "flagged")
      .where("flag.resolved_at", "is", null)
      .orderBy("submission.id")
      .execute();
    if (flagged.length)
      await trx
        .insertInto("app.evidence_review_items")
        .values(
          flagged.map((submission, index) => ({
            id: randomUUID(),
            meeting_id: meetingId,
            submission_id: submission.id,
            position: index + 1,
            resolution: null,
            resolved_at: null,
          })),
        )
        .execute();
    return { id: meetingId, deadline };
  }

  private async finishGame(
    trx: Transaction<DatabaseSchema>,
    game: { id: string; room_id: string },
    winner: "crew" | "imposters",
    version: number,
    now: Date,
    meetingId?: string,
  ): Promise<void> {
    await trx
      .updateTable("app.games")
      .set({
        phase: "game_over",
        state_version: version,
        winner,
        phase_started_at: now,
        phase_deadline_at: null,
        ended_at: now,
      })
      .where("id", "=", game.id)
      .execute();
    await trx
      .updateTable("app.rooms")
      .set({ status: "completed", last_activity_at: now })
      .where("id", "=", game.room_id)
      .execute();
    if (meetingId)
      await trx
        .updateTable("app.meetings")
        .set({ phase: "resolved", deadline_at: null, resolved_at: now })
        .where("id", "=", meetingId)
        .where("resolved_at", "is", null)
        .execute();
  }

  async kill(
    principal: ParticipantPrincipal,
    input: KillInput,
    key: string,
  ): Promise<GameSnapshotDto> {
    const result = await inTransaction(this.database, async (trx) => {
      const operation = "game.kill";
      const replayed = await this.replay<GameSnapshotDto>(
        trx,
        principal.participantId,
        key,
        operation,
        input,
      );
      if (replayed) return { snapshot: replayed, changed: false };
      const game = await trx
        .selectFrom("app.games")
        .selectAll()
        .where("room_id", "=", principal.roomId)
        .forUpdate()
        .executeTakeFirst();
      if (!game) throw new ApplicationError(404, "GAME_NOT_FOUND", "No current game was found.");
      this.assertVersion(game, input.expectedStateVersion);
      if (game.phase !== "task")
        throw new ApplicationError(
          409,
          "ACTION_NOT_ALLOWED_IN_PHASE",
          "Kills are allowed only during task play.",
        );
      const actor = await trx
        .selectFrom("app.game_participants")
        .selectAll()
        .where("game_id", "=", game.id)
        .where("participant_id", "=", principal.participantId)
        .executeTakeFirst();
      if (!actor || actor.role !== "imposter" || actor.life_status !== "alive")
        throw new ApplicationError(
          403,
          "ROLE_NOT_ALLOWED",
          "Only a living imposter can eliminate a player.",
        );
      const now = new Date();
      if (actor.kill_available_at && new Date(actor.kill_available_at) > now)
        throw new ApplicationError(409, "KILL_COOLDOWN", "The kill cooldown has not elapsed.", {
          availableAt: iso(actor.kill_available_at),
        });
      if (input.targetParticipantId === principal.participantId)
        throw new ApplicationError(409, "TARGET_NOT_ELIGIBLE", "The target is not eligible.");
      const target = await trx
        .selectFrom("app.game_participants")
        .select(["participant_id", "life_status"])
        .where("game_id", "=", game.id)
        .where("participant_id", "=", input.targetParticipantId)
        .forUpdate()
        .executeTakeFirst();
      if (!target || target.life_status !== "alive")
        throw new ApplicationError(409, "TARGET_NOT_ELIGIBLE", "The target is not eligible.");
      await trx
        .updateTable("app.game_participants")
        .set({ life_status: "killed" })
        .where("game_id", "=", game.id)
        .where("participant_id", "=", target.participant_id)
        .execute();
      const meeting = await this.createMeeting(
        trx,
        game,
        "kill",
        principal.participantId,
        target.participant_id,
        now,
      );
      await trx
        .insertInto("app.eliminations")
        .values({
          id: randomUUID(),
          game_id: game.id,
          meeting_id: meeting.id,
          target_participant_id: target.participant_id,
          actor_participant_id: principal.participantId,
          type: "killed",
          occurred_at: now,
        })
        .execute();
      const nextVersion = Number(game.state_version) + 1;
      const winner = await this.winnerWith(trx, game.id);
      if (winner) await this.finishGame(trx, game, winner, nextVersion, now, meeting.id);
      else
        await trx
          .updateTable("app.games")
          .set({
            phase: "discussion",
            state_version: nextVersion,
            phase_started_at: now,
            phase_deadline_at: meeting.deadline,
          })
          .where("id", "=", game.id)
          .execute();
      await trx
        .insertInto("app.game_events")
        .values({
          game_id: game.id,
          state_version: nextVersion,
          type: winner ? "game.ended" : "meeting.started",
          actor_participant_id: null,
          visibility: "public",
          payload: winner
            ? { schemaVersion: 1, winner, eliminatedParticipantId: target.participant_id }
            : {
                schemaVersion: 1,
                meetingId: meeting.id,
                eliminatedParticipantId: target.participant_id,
              },
        })
        .execute();
      const snapshot = await this.snapshotWith(trx, principal);
      await this.remember(trx, principal.participantId, key, operation, input, snapshot);
      return { snapshot, changed: true };
    });
    if (result.changed)
      this.events.gameChanged(principal.roomId, result.snapshot.id, result.snapshot.stateVersion);
    return result.snapshot;
  }

  currentMeeting(principal: ParticipantPrincipal): Promise<MeetingDto> {
    return this.snapshot(principal).then((snapshot) => {
      if (!snapshot.meeting)
        throw new ApplicationError(404, "MEETING_NOT_FOUND", "No meeting was found.");
      return snapshot.meeting;
    });
  }

  private async enterVoting(
    trx: Transaction<DatabaseSchema>,
    gameId: string,
    meetingId: string,
    now: Date,
  ): Promise<Date> {
    const settings = await trx
      .selectFrom("app.games as game")
      .innerJoin("app.rooms as room", "room.id", "game.room_id")
      .select("room.voting_seconds")
      .where("game.id", "=", gameId)
      .executeTakeFirstOrThrow();
    const deadline = new Date(now.getTime() + settings.voting_seconds * 1000);
    await trx
      .updateTable("app.meetings")
      .set({ phase: "voting", deadline_at: deadline })
      .where("id", "=", meetingId)
      .execute();
    await trx
      .updateTable("app.games")
      .set({ phase: "voting", phase_started_at: now, phase_deadline_at: deadline })
      .where("id", "=", gameId)
      .execute();
    return deadline;
  }

  private async resolveCurrentReview(
    trx: Transaction<DatabaseSchema>,
    game: { id: string },
    meetingId: string,
    reviewItemId: string,
    now: Date,
  ): Promise<{ resolution: "valid" | "invalid"; phase: "review" | "voting" }> {
    const votes = await trx
      .selectFrom("app.evidence_review_votes")
      .select("decision")
      .where("review_item_id", "=", reviewItemId)
      .execute();
    const resolution = resolveReview(votes.map((vote) => vote.decision));
    const item = await trx
      .selectFrom("app.evidence_review_items as item")
      .innerJoin("app.task_submissions as submission", "submission.id", "item.submission_id")
      .select(["item.submission_id", "submission.assignment_id"])
      .where("item.id", "=", reviewItemId)
      .executeTakeFirstOrThrow();
    await trx
      .updateTable("app.evidence_review_items")
      .set({ resolution, resolved_at: now })
      .where("id", "=", reviewItemId)
      .where("resolution", "is", null)
      .execute();
    await trx
      .updateTable("app.submission_flags")
      .set({ resolved_at: now })
      .where("submission_id", "=", item.submission_id)
      .where("resolved_at", "is", null)
      .execute();
    await trx
      .updateTable("app.task_submissions")
      .set({ review_status: resolution })
      .where("id", "=", item.submission_id)
      .execute();
    if (resolution === "invalid")
      await trx
        .updateTable("app.task_assignments")
        .set({ status: "assigned", completed_at: null })
        .where("id", "=", item.assignment_id)
        .execute();
    const next = await trx
      .selectFrom("app.evidence_review_items")
      .select("id")
      .where("meeting_id", "=", meetingId)
      .where("resolution", "is", null)
      .orderBy("position")
      .executeTakeFirst();
    if (!next) {
      await this.enterVoting(trx, game.id, meetingId, now);
      return { resolution, phase: "voting" };
    }
    const settings = await trx
      .selectFrom("app.games as game")
      .innerJoin("app.rooms as room", "room.id", "game.room_id")
      .select("room.review_seconds")
      .where("game.id", "=", game.id)
      .executeTakeFirstOrThrow();
    const deadline = new Date(now.getTime() + settings.review_seconds * 1000);
    await trx
      .updateTable("app.meetings")
      .set({ deadline_at: deadline })
      .where("id", "=", meetingId)
      .execute();
    await trx
      .updateTable("app.games")
      .set({ phase_started_at: now, phase_deadline_at: deadline })
      .where("id", "=", game.id)
      .execute();
    return { resolution, phase: "review" };
  }

  async reviewVote(
    principal: ParticipantPrincipal,
    reviewItemId: string,
    input: ReviewVoteInput,
    key: string,
  ) {
    const result = await inTransaction(this.database, async (trx) => {
      const operation = `meeting.review-vote:${reviewItemId}`;
      const replayed = await this.replay<Record<string, unknown>>(
        trx,
        principal.participantId,
        key,
        operation,
        input,
      );
      if (replayed)
        return { response: replayed, changed: false, roomId: principal.roomId, gameId: "" };
      const item = await trx
        .selectFrom("app.evidence_review_items as item")
        .innerJoin("app.meetings as meeting", "meeting.id", "item.meeting_id")
        .innerJoin("app.games as game", "game.id", "meeting.game_id")
        .select([
          "item.meeting_id",
          "item.resolution",
          "meeting.phase as meeting_phase",
          "game.id as game_id",
          "game.room_id",
          "game.state_version",
        ])
        .where("item.id", "=", reviewItemId)
        .executeTakeFirst();
      if (!item || item.room_id !== principal.roomId)
        throw new ApplicationError(404, "REVIEW_ITEM_NOT_FOUND", "The review item was not found.");
      const game = await trx
        .selectFrom("app.games")
        .selectAll()
        .where("id", "=", item.game_id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      this.assertVersion(game, input.expectedStateVersion);
      if (game.phase !== "review" || item.meeting_phase !== "review" || item.resolution)
        throw new ApplicationError(409, "REVIEW_LOCKED", "This review item is locked.");
      const current = await trx
        .selectFrom("app.evidence_review_items")
        .select("id")
        .where("meeting_id", "=", item.meeting_id)
        .where("resolution", "is", null)
        .orderBy("position")
        .executeTakeFirstOrThrow();
      if (current.id !== reviewItemId)
        throw new ApplicationError(409, "REVIEW_LOCKED", "This review item is not currently open.");
      const eligible = await trx
        .selectFrom("app.meeting_eligible_voters")
        .select("participant_id")
        .where("meeting_id", "=", item.meeting_id)
        .where("participant_id", "=", principal.participantId)
        .executeTakeFirst();
      if (!eligible)
        throw new ApplicationError(
          403,
          "PLAYER_NOT_ELIGIBLE",
          "Only eligible living players may vote.",
        );
      const now = new Date();
      await trx
        .insertInto("app.evidence_review_votes")
        .values({
          id: randomUUID(),
          review_item_id: reviewItemId,
          voter_participant_id: principal.participantId,
          decision: input.decision,
          created_at: now,
          updated_at: now,
        })
        .onConflict((conflict) =>
          conflict.columns(["review_item_id", "voter_participant_id"]).doUpdateSet({
            decision: input.decision,
            updated_at: now,
          }),
        )
        .execute();
      const [cast, voters] = await Promise.all([
        trx
          .selectFrom("app.evidence_review_votes")
          .select(sql<number>`count(*)::int`.as("count"))
          .where("review_item_id", "=", reviewItemId)
          .executeTakeFirstOrThrow(),
        trx
          .selectFrom("app.meeting_eligible_voters")
          .select(sql<number>`count(*)::int`.as("count"))
          .where("meeting_id", "=", item.meeting_id)
          .executeTakeFirstOrThrow(),
      ]);
      let phase: "review" | "voting" = "review";
      let resolution: "valid" | "invalid" | null = null;
      if (cast.count === voters.count) {
        const resolved = await this.resolveCurrentReview(
          trx,
          game,
          item.meeting_id,
          reviewItemId,
          now,
        );
        phase = resolved.phase;
        resolution = resolved.resolution;
      }
      const nextVersion = Number(game.state_version) + 1;
      await trx
        .updateTable("app.games")
        .set({ state_version: nextVersion })
        .where("id", "=", game.id)
        .execute();
      await trx
        .insertInto("app.game_events")
        .values({
          game_id: game.id,
          state_version: nextVersion,
          type: resolution ? "review.resolved" : "review.vote_recorded",
          actor_participant_id: resolution ? null : principal.participantId,
          visibility: resolution ? "public" : "actor",
          payload: resolution
            ? { schemaVersion: 1, reviewItemId, resolution }
            : { schemaVersion: 1, reviewItemId },
        })
        .execute();
      const response = {
        reviewItemId,
        decision: input.decision,
        votesCast: cast.count,
        resolution,
        phase,
        stateVersion: nextVersion,
      };
      await this.remember(trx, principal.participantId, key, operation, input, response);
      return { response, changed: true, roomId: game.room_id, gameId: game.id };
    });
    if (result.changed)
      this.events.gameChanged(result.roomId, result.gameId, Number(result.response.stateVersion));
    return result.response;
  }

  private async resolveVoting(
    trx: Transaction<DatabaseSchema>,
    game: { id: string; room_id: string; state_version: string },
    meetingId: string,
    now: Date,
  ): Promise<{ winner: "crew" | "imposters" | null; ejectedParticipantId: string | null }> {
    const votes = await trx
      .selectFrom("app.ejection_votes")
      .select("target_participant_id")
      .where("meeting_id", "=", meetingId)
      .execute();
    const tally = resolveEjection(votes.map((vote) => vote.target_participant_id));
    if (tally.targetParticipantId) {
      const target = await trx
        .selectFrom("app.game_participants")
        .select("life_status")
        .where("game_id", "=", game.id)
        .where("participant_id", "=", tally.targetParticipantId)
        .forUpdate()
        .executeTakeFirst();
      if (target?.life_status === "alive") {
        await trx
          .updateTable("app.game_participants")
          .set({ life_status: "ejected" })
          .where("game_id", "=", game.id)
          .where("participant_id", "=", tally.targetParticipantId)
          .execute();
        await trx
          .insertInto("app.eliminations")
          .values({
            id: randomUUID(),
            game_id: game.id,
            meeting_id: meetingId,
            target_participant_id: tally.targetParticipantId,
            actor_participant_id: null,
            type: "ejected",
            occurred_at: now,
          })
          .execute();
      }
    }
    await trx
      .updateTable("app.meetings")
      .set({
        phase: "resolved",
        deadline_at: null,
        ejected_participant_id: tally.targetParticipantId,
        resolved_at: now,
      })
      .where("id", "=", meetingId)
      .execute();
    const winner = await this.winnerWith(trx, game.id);
    const nextVersion = Number(game.state_version) + 1;
    if (winner) await this.finishGame(trx, game, winner, nextVersion, now);
    else
      await trx
        .updateTable("app.games")
        .set({
          phase: "result",
          state_version: nextVersion,
          phase_started_at: now,
          phase_deadline_at: new Date(now.getTime() + RESULT_SECONDS * 1000),
        })
        .where("id", "=", game.id)
        .execute();
    return { winner, ejectedParticipantId: tally.targetParticipantId };
  }

  async ejectionVote(
    principal: ParticipantPrincipal,
    meetingId: string,
    input: EjectionVoteInput,
    key: string,
  ) {
    const result = await inTransaction(this.database, async (trx) => {
      const operation = `meeting.ejection-vote:${meetingId}`;
      const replayed = await this.replay<Record<string, unknown>>(
        trx,
        principal.participantId,
        key,
        operation,
        input,
      );
      if (replayed)
        return { response: replayed, changed: false, roomId: principal.roomId, gameId: "" };
      const meeting = await trx
        .selectFrom("app.meetings as meeting")
        .innerJoin("app.games as game", "game.id", "meeting.game_id")
        .select([
          "meeting.phase as meeting_phase",
          "meeting.resolved_at",
          "game.id as game_id",
          "game.room_id",
          "game.state_version",
        ])
        .where("meeting.id", "=", meetingId)
        .executeTakeFirst();
      if (!meeting || meeting.room_id !== principal.roomId)
        throw new ApplicationError(404, "MEETING_NOT_FOUND", "The meeting was not found.");
      const game = await trx
        .selectFrom("app.games")
        .selectAll()
        .where("id", "=", meeting.game_id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      this.assertVersion(game, input.expectedStateVersion);
      if (game.phase !== "voting" || meeting.meeting_phase !== "voting" || meeting.resolved_at)
        throw new ApplicationError(409, "VOTING_LOCKED", "Voting is locked.");
      const eligible = await trx
        .selectFrom("app.meeting_eligible_voters")
        .select("participant_id")
        .where("meeting_id", "=", meetingId)
        .where("participant_id", "=", principal.participantId)
        .executeTakeFirst();
      if (!eligible)
        throw new ApplicationError(
          403,
          "PLAYER_NOT_ELIGIBLE",
          "Only eligible living players may vote.",
        );
      if (input.targetParticipantId) {
        const target = await trx
          .selectFrom("app.meeting_eligible_voters")
          .select("participant_id")
          .where("meeting_id", "=", meetingId)
          .where("participant_id", "=", input.targetParticipantId)
          .executeTakeFirst();
        if (!target)
          throw new ApplicationError(
            409,
            "TARGET_NOT_ELIGIBLE",
            "The vote target is not eligible.",
          );
      }
      const now = new Date();
      await trx
        .insertInto("app.ejection_votes")
        .values({
          id: randomUUID(),
          meeting_id: meetingId,
          voter_participant_id: principal.participantId,
          target_participant_id: input.targetParticipantId,
          created_at: now,
          updated_at: now,
        })
        .onConflict((conflict) =>
          conflict.columns(["meeting_id", "voter_participant_id"]).doUpdateSet({
            target_participant_id: input.targetParticipantId,
            updated_at: now,
          }),
        )
        .execute();
      const [cast, voters] = await Promise.all([
        trx
          .selectFrom("app.ejection_votes")
          .select(sql<number>`count(*)::int`.as("count"))
          .where("meeting_id", "=", meetingId)
          .executeTakeFirstOrThrow(),
        trx
          .selectFrom("app.meeting_eligible_voters")
          .select(sql<number>`count(*)::int`.as("count"))
          .where("meeting_id", "=", meetingId)
          .executeTakeFirstOrThrow(),
      ]);
      let resolution: Awaited<ReturnType<GameService["resolveVoting"]>> | null = null;
      if (cast.count === voters.count)
        resolution = await this.resolveVoting(trx, game, meetingId, now);
      const stateVersion = Number(game.state_version) + 1;
      if (!resolution)
        await trx
          .updateTable("app.games")
          .set({ state_version: stateVersion })
          .where("id", "=", game.id)
          .execute();
      await trx
        .insertInto("app.game_events")
        .values({
          game_id: game.id,
          state_version: stateVersion,
          type: resolution?.winner
            ? "game.ended"
            : resolution
              ? "meeting.resolved"
              : "ejection.vote_recorded",
          actor_participant_id: resolution ? null : principal.participantId,
          visibility: resolution ? "public" : "actor",
          payload: resolution
            ? {
                schemaVersion: 1,
                meetingId,
                ejectedParticipantId: resolution.ejectedParticipantId,
                winner: resolution.winner,
              }
            : { schemaVersion: 1, meetingId },
        })
        .execute();
      const response = {
        meetingId,
        targetParticipantId: input.targetParticipantId,
        votesCast: cast.count,
        resolved: Boolean(resolution),
        stateVersion,
      };
      await this.remember(trx, principal.participantId, key, operation, input, response);
      return { response, changed: true, roomId: game.room_id, gameId: game.id };
    });
    if (result.changed)
      this.events.gameChanged(result.roomId, result.gameId, Number(result.response.stateVersion));
    return result.response;
  }

  async runDueTransitions(limit = 25): Promise<number> {
    let advanced = 0;
    for (; advanced < limit; advanced += 1) {
      const candidate = await this.database
        .selectFrom("app.games")
        .select("id")
        .where("phase_deadline_at", "<=", new Date())
        .where("phase", "not in", ["game_over", "abandoned"])
        .orderBy("phase_deadline_at")
        .executeTakeFirst();
      if (!candidate) break;
      const changed = await this.advanceDue(candidate.id);
      if (!changed) break;
      this.events.gameChanged(changed.roomId, changed.gameId, changed.stateVersion);
    }
    return advanced;
  }

  private async advanceDue(gameId: string) {
    return inTransaction(this.database, async (trx) => {
      const game = await trx
        .selectFrom("app.games")
        .selectAll()
        .where("id", "=", gameId)
        .forUpdate()
        .executeTakeFirst();
      const now = new Date();
      if (!game || !game.phase_deadline_at || new Date(game.phase_deadline_at) > now) return null;
      const nextVersion = Number(game.state_version) + 1;
      let eventType = "meeting.phase_changed";
      let payload: Record<string, unknown> = { schemaVersion: 1 };
      if (game.phase === "task") {
        const meeting = await this.createMeeting(trx, game, "task_deadline", null, null, now);
        await trx
          .updateTable("app.games")
          .set({
            phase: "discussion",
            state_version: nextVersion,
            phase_started_at: now,
            phase_deadline_at: meeting.deadline,
          })
          .where("id", "=", game.id)
          .execute();
        eventType = "meeting.started";
        payload = { schemaVersion: 1, meetingId: meeting.id, triggerType: "task_deadline" };
      } else if (game.phase === "discussion") {
        const meeting = await trx
          .selectFrom("app.meetings")
          .select("id")
          .where("game_id", "=", game.id)
          .where("resolved_at", "is", null)
          .executeTakeFirstOrThrow();
        const review = await trx
          .selectFrom("app.evidence_review_items")
          .select("id")
          .where("meeting_id", "=", meeting.id)
          .where("resolution", "is", null)
          .executeTakeFirst();
        if (review) {
          const settings = await trx
            .selectFrom("app.rooms")
            .select("review_seconds")
            .where("id", "=", game.room_id)
            .executeTakeFirstOrThrow();
          const deadline = new Date(now.getTime() + settings.review_seconds * 1000);
          await trx
            .updateTable("app.meetings")
            .set({ phase: "review", deadline_at: deadline })
            .where("id", "=", meeting.id)
            .execute();
          await trx
            .updateTable("app.games")
            .set({
              phase: "review",
              state_version: nextVersion,
              phase_started_at: now,
              phase_deadline_at: deadline,
            })
            .where("id", "=", game.id)
            .execute();
          payload = { schemaVersion: 1, meetingId: meeting.id, phase: "review" };
        } else {
          await this.enterVoting(trx, game.id, meeting.id, now);
          await trx
            .updateTable("app.games")
            .set({ state_version: nextVersion })
            .where("id", "=", game.id)
            .execute();
          payload = { schemaVersion: 1, meetingId: meeting.id, phase: "voting" };
        }
      } else if (game.phase === "review") {
        const meeting = await trx
          .selectFrom("app.meetings")
          .select("id")
          .where("game_id", "=", game.id)
          .where("resolved_at", "is", null)
          .executeTakeFirstOrThrow();
        const review = await trx
          .selectFrom("app.evidence_review_items")
          .select("id")
          .where("meeting_id", "=", meeting.id)
          .where("resolution", "is", null)
          .orderBy("position")
          .executeTakeFirstOrThrow();
        const resolved = await this.resolveCurrentReview(trx, game, meeting.id, review.id, now);
        await trx
          .updateTable("app.games")
          .set({ state_version: nextVersion })
          .where("id", "=", game.id)
          .execute();
        eventType = "review.resolved";
        payload = {
          schemaVersion: 1,
          meetingId: meeting.id,
          reviewItemId: review.id,
          resolution: resolved.resolution,
        };
      } else if (game.phase === "voting") {
        const meeting = await trx
          .selectFrom("app.meetings")
          .select("id")
          .where("game_id", "=", game.id)
          .where("resolved_at", "is", null)
          .executeTakeFirstOrThrow();
        const resolved = await this.resolveVoting(trx, game, meeting.id, now);
        eventType = resolved.winner ? "game.ended" : "meeting.resolved";
        payload = { schemaVersion: 1, meetingId: meeting.id, ...resolved };
      } else if (game.phase === "result") {
        const room = await trx
          .selectFrom("app.rooms")
          .select("task_phase_seconds")
          .where("id", "=", game.room_id)
          .executeTakeFirstOrThrow();
        const deadline = new Date(now.getTime() + room.task_phase_seconds * 1000);
        await trx
          .updateTable("app.game_participants")
          .set({ kill_available_at: new Date(now.getTime() + KILL_COOLDOWN_SECONDS * 1000) })
          .where("game_id", "=", game.id)
          .where("role", "=", "imposter")
          .where("life_status", "=", "alive")
          .execute();
        await trx
          .updateTable("app.games")
          .set({
            phase: "task",
            state_version: nextVersion,
            phase_started_at: now,
            phase_deadline_at: deadline,
          })
          .where("id", "=", game.id)
          .execute();
        eventType = "task_phase.started";
      } else return null;
      await trx
        .insertInto("app.game_events")
        .values({
          game_id: game.id,
          state_version: nextVersion,
          type: eventType,
          actor_participant_id: null,
          visibility: "public",
          payload,
        })
        .execute();
      return { roomId: game.room_id, gameId: game.id, stateVersion: nextVersion };
    });
  }
}
