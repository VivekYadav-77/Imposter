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
  killCooldownSeconds,
  maximumImposterCount,
  meetingCooldownSeconds,
  resolveEjection,
  resolveReview,
} from "./domain.js";
import { createAssignmentPlan, sampleDistinct, secureShuffle } from "./random.js";
import type { CallMeetingInput, EjectionVoteInput, KillInput, ReviewVoteInput } from "./schemas.js";
import type { GameSnapshotDto, MeetingDto } from "./types.js";

type Executor = Database | Transaction<DatabaseSchema>;

const RESULT_SECONDS = 10;

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

  private async eligiblePresence(executor: Executor, meetingId: string) {
    return executor
      .selectFrom("app.meeting_eligible_voters as eligible")
      .innerJoin("app.participants as participant", "participant.id", "eligible.participant_id")
      .select(["eligible.participant_id", "participant.disconnected_at"])
      .where("eligible.meeting_id", "=", meetingId)
      .execute();
  }

  private requiredVotes(
    eligible: Array<{ participant_id: string; disconnected_at: Date | string | null }>,
    castParticipantIds: string[],
    dynamic: boolean,
  ): number {
    if (!dynamic) return eligible.length;
    const cast = new Set(castParticipantIds);
    return eligible.filter((voter) => !voter.disconnected_at || cast.has(voter.participant_id))
      .length;
  }

  private async ejectionQuorum(executor: Executor, meetingId: string, dynamic: boolean) {
    const [eligible, votes] = await Promise.all([
      this.eligiblePresence(executor, meetingId),
      executor
        .selectFrom("app.ejection_votes")
        .select("voter_participant_id")
        .where("meeting_id", "=", meetingId)
        .execute(),
    ]);
    const castParticipantIds = votes.map((vote) => vote.voter_participant_id);
    const required = this.requiredVotes(eligible, castParticipantIds, dynamic);
    return { cast: votes.length, required, complete: votes.length > 0 && votes.length >= required };
  }

  private async reviewQuorum(
    executor: Executor,
    meetingId: string,
    reviewItemId: string,
    dynamic: boolean,
  ) {
    const [eligible, votes] = await Promise.all([
      this.eligiblePresence(executor, meetingId),
      executor
        .selectFrom("app.evidence_review_votes")
        .select("voter_participant_id")
        .where("review_item_id", "=", reviewItemId)
        .execute(),
    ]);
    const castParticipantIds = votes.map((vote) => vote.voter_participant_id);
    const required = this.requiredVotes(eligible, castParticipantIds, dynamic);
    return { cast: votes.length, required, complete: votes.length > 0 && votes.length >= required };
  }

  private async meetingWith(
    executor: Executor,
    gameId: string,
    participantId: string,
    gamePhase: string,
  ): Promise<MeetingDto | null> {
    if (gamePhase === "task" || gamePhase === "abandoned") return null;
    const meeting = await executor
      .selectFrom("app.meetings as meeting")
      .innerJoin("app.games as game", "game.id", "meeting.game_id")
      .innerJoin("app.rooms as room", "room.id", "game.room_id")
      .selectAll("meeting")
      .select(["room.vote_visibility", "room.meeting_voting_mode"])
      .where("meeting.game_id", "=", gameId)
      .orderBy("meeting.sequence_number", "desc")
      .executeTakeFirst();
    if (!meeting) return null;
    const eligible = await executor
      .selectFrom("app.meeting_eligible_voters as eligible")
      .innerJoin("app.participants as participant", "participant.id", "eligible.participant_id")
      .select(["participant.id", "participant.nickname", "participant.disconnected_at"])
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
            .select("voter_participant_id")
            .where("review_item_id", "=", review.id)
            .execute()
        : Promise.resolve([]),
      executor
        .selectFrom("app.ejection_votes")
        .select("target_participant_id")
        .where("meeting_id", "=", meeting.id)
        .where("voter_participant_id", "=", participantId)
        .executeTakeFirst(),
      executor
        .selectFrom("app.ejection_votes")
        .select(["voter_participant_id", "target_participant_id"])
        .where("meeting_id", "=", meeting.id)
        .execute(),
    ]);
    const eligibleSelf = eligible.some((entry) => entry.id === participantId);
    const dynamicQuorum =
      meeting.meeting_voting_mode === "all_voted" &&
      (gamePhase === "voting" || gamePhase === "review");
    const ejectionVoters = new Set(ejectionVotes.map((vote) => vote.voter_participant_id));
    const requiredVotes = eligible.filter(
      (entry) => !dynamicQuorum || !entry.disconnected_at || ejectionVoters.has(entry.id),
    ).length;
    const result =
      meeting.phase === "resolved"
        ? resolveEjection(ejectionVotes.map((v) => v.target_participant_id))
        : null;
    const publicVotes =
      meeting.vote_visibility === "public"
        ? ejectionVotes.map((vote) => ({
            voterParticipantId: vote.voter_participant_id,
            voterNickname:
              eligible.find((entry) => entry.id === vote.voter_participant_id)?.nickname ??
              "Unknown player",
            targetParticipantId: vote.target_participant_id,
            targetNickname: vote.target_participant_id
              ? (eligible.find((entry) => entry.id === vote.target_participant_id)?.nickname ??
                "Unknown player")
              : null,
          }))
        : [];
    return {
      id: meeting.id,
      sequenceNumber: meeting.sequence_number,
      triggerType: meeting.trigger_type,
      reportedParticipantId: meeting.reported_participant_id,
      phase: meeting.phase,
      deadlineAt: meeting.deadline_at ? iso(meeting.deadline_at) : null,
      eligibleParticipants: eligible.map(({ id, nickname }) => ({ id, nickname })),
      reviewItem: review
        ? {
            id: review.id,
            submissionId: review.submission_id,
            position: review.position,
            total: reviewCount.count,
            uploader: { id: review.uploader_id, nickname: review.uploader_nickname },
            assignmentDescription: review.description_snapshot,
            ownDecision: ownReview?.decision ?? null,
            votesCast: reviewVotes.length,
            requiredVotes: eligible.filter(
              (entry) =>
                !dynamicQuorum ||
                !entry.disconnected_at ||
                reviewVotes.some((vote) => vote.voter_participant_id === entry.id),
            ).length,
          }
        : null,
      ownEjectionTargetParticipantId: ownEjection?.target_participant_id ?? null,
      hasCastEjectionVote: Boolean(ownEjection),
      votesCast: ejectionVotes.length,
      requiredVotes,
      publicVotes,
      result: result
        ? {
            ejectedParticipantId: meeting.ejected_participant_id,
            totals: Object.entries(result.totals).map(([participantId, votes]) => ({
              participantId,
              votes,
            })),
            skipVotes: result.skip,
            ...(meeting.vote_visibility === "public" ? { ballots: publicVotes } : {}),
          }
        : null,
      capabilities:
        eligibleSelf && meeting.phase === "review"
          ? ["vote_review"]
          : eligibleSelf && meeting.phase === "voting" && !ownEjection
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
        "games.end_reason",
        "games.task_pack_name_snapshot",
        "games.phase_started_at",
        "games.phase_deadline_at",
        "games.started_at",
        "games.ended_at",
        "games.meeting_available_at",
        "rooms.host_participant_id",
        "rooms.task_phase_seconds",
        "rooms.meeting_duration_seconds",
        "rooms.meeting_voting_mode",
        "rooms.vote_visibility",
        "rooms.imposter_cooldown_seconds",
        "rooms.meetings_per_player",
        "self.role",
        "self.life_status",
        "self.kill_available_at",
        "self.crew_role_name",
        "self.crew_role_specialization",
        "self.crew_role_ability",
      ])
      .where("games.room_id", "=", principal.roomId)
      .orderBy("games.started_at", "desc")
      .executeTakeFirst();
    if (!game) throw new ApplicationError(404, "GAME_NOT_FOUND", "No current game was found.");

    const [
      participants,
      assignments,
      progress,
      meeting,
      meetingsCalled,
      completedBySelf,
      ownEliminations,
      participantTaskStats,
    ] = await Promise.all([
      executor
        .selectFrom("app.game_participants as gp")
        .innerJoin("app.participants as participants", "participants.id", "gp.participant_id")
        .select([
          "participants.id",
          "participants.nickname",
          "gp.life_status",
          "gp.role",
          "gp.crew_role_name",
          "gp.crew_role_specialization",
          "gp.crew_role_ability",
        ])
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
          "tasks.difficulty_snapshot",
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
      executor
        .selectFrom("app.meetings")
        .select(sql<number>`count(*)::int`.as("count"))
        .where("game_id", "=", game.id)
        .where("trigger_type", "=", "user_called")
        .where("trigger_actor_participant_id", "=", principal.participantId)
        .executeTakeFirstOrThrow(),
      executor
        .selectFrom("app.task_assignments")
        .select(sql<number>`count(*) filter (where status = 'completed')::int`.as("count"))
        .where("game_id", "=", game.id)
        .where("participant_id", "=", principal.participantId)
        .executeTakeFirstOrThrow(),
      executor
        .selectFrom("app.eliminations")
        .select("target_participant_id")
        .where("game_id", "=", game.id)
        .where("actor_participant_id", "=", principal.participantId)
        .where("type", "=", "killed")
        .execute(),
      executor
        .selectFrom("app.task_assignments")
        .select([
          "participant_id",
          sql<number>`count(*)::int`.as("total"),
          sql<number>`count(*) filter (where status = 'completed')::int`.as("completed"),
        ])
        .where("game_id", "=", game.id)
        .groupBy("participant_id")
        .execute(),
    ]);

    const taskProgress = progress.total ? progress.completed / progress.total : 0;
    const elapsedSeconds = Math.max(0, (Date.now() - new Date(game.started_at).getTime()) / 1000);
    const timeProgress = Math.min(1, elapsedSeconds / game.task_phase_seconds);
    const dynamicMeetingCooldown = meetingCooldownSeconds(
      game.meeting_duration_seconds,
      taskProgress,
      timeProgress,
    );
    const dynamicKillCooldown = killCooldownSeconds(
      game.imposter_cooldown_seconds,
      taskProgress,
      timeProgress,
    );
    const capabilities = capabilitiesFor({
      phase: game.phase,
      role: game.role,
      lifeStatus: game.life_status,
      isHost: principal.participantId === game.host_participant_id,
      winner: game.winner,
    }).filter((capability) => {
      if (capability !== "call_meeting") return true;
      return (
        completedBySelf.count > 0 &&
        meetingsCalled.count < game.meetings_per_player &&
        (!game.meeting_available_at || new Date(game.meeting_available_at).getTime() <= Date.now())
      );
    });

    return {
      id: game.id,
      roomId: game.room_id,
      phase: game.phase,
      stateVersion: Number(game.state_version),
      winner: game.winner,
      endReason: game.end_reason,
      taskPack: { name: game.task_pack_name_snapshot },
      phaseStartedAt: iso(game.phase_started_at),
      phaseDeadlineAt: game.phase_deadline_at ? iso(game.phase_deadline_at) : null,
      participants: participants.map((participant) => ({
        id: participant.id,
        nickname: participant.nickname,
        isHost: participant.id === game.host_participant_id,
        lifeStatus:
          participant.id === principal.participantId || participant.life_status !== "killed"
            ? participant.life_status
            : "alive",
      })),
      self: {
        participantId: principal.participantId,
        role: game.role,
        lifeStatus: game.life_status,
        capabilities,
        killableParticipantIds:
          game.role === "imposter"
            ? participants
                .filter(
                  (participant) =>
                    participant.role === "crew" && participant.life_status === "alive",
                )
                .map((participant) => participant.id)
            : [],
        knownEliminatedParticipantIds: ownEliminations.map(
          (elimination) => elimination.target_participant_id,
        ),
        crewRole:
          game.crew_role_name && game.crew_role_specialization && game.crew_role_ability
            ? {
                name: game.crew_role_name,
                specialization: game.crew_role_specialization,
                ability: game.crew_role_ability,
              }
            : null,
      },
      assignments: assignments.map((assignment) => ({
        id: assignment.id,
        description: assignment.description_snapshot,
        status: assignment.status,
        completedAt: assignment.completed_at ? iso(assignment.completed_at) : null,
        difficulty: assignment.difficulty_snapshot,
      })),
      progress: { percent: Math.round(taskProgress * 100) },
      cooldowns: {
        killAvailableAt: game.kill_available_at ? iso(game.kill_available_at) : null,
        meetingAvailableAt: game.meeting_available_at ? iso(game.meeting_available_at) : null,
        meetingCooldownSeconds: dynamicMeetingCooldown,
        killCooldownSeconds: dynamicKillCooldown,
      },
      meetingRules: {
        durationSeconds: game.meeting_duration_seconds,
        votingMode: game.meeting_voting_mode,
        voteVisibility: game.vote_visibility,
        maxPerPlayer: game.meetings_per_player,
        calledBySelf: meetingsCalled.count,
        remainingForSelf: Math.max(0, game.meetings_per_player - meetingsCalled.count),
        hasCompletedTask: completedBySelf.count > 0,
      },
      meeting,
      resultSummary:
        game.phase === "game_over" || game.phase === "abandoned"
          ? {
              durationSeconds: Math.max(
                0,
                Math.round(
                  ((game.ended_at ? new Date(game.ended_at).getTime() : Date.now()) -
                    new Date(game.started_at).getTime()) /
                    1000,
                ),
              ),
              completedTasks: progress.completed,
              totalTasks: progress.total,
              players: participants.map((participant) => {
                const stats = participantTaskStats.find(
                  (entry) => entry.participant_id === participant.id,
                );
                return {
                  id: participant.id,
                  nickname: participant.nickname,
                  role: participant.role,
                  crewRole:
                    participant.crew_role_name &&
                    participant.crew_role_specialization &&
                    participant.crew_role_ability
                      ? {
                          name: participant.crew_role_name,
                          specialization: participant.crew_role_specialization,
                          ability: participant.crew_role_ability,
                        }
                      : null,
                  lifeStatus: participant.life_status,
                  completedTasks: stats?.completed ?? 0,
                  totalTasks: stats?.total ?? 0,
                };
              }),
            }
          : null,
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
      if (participants.length < room.min_players || participants.length > room.max_players)
        reasons.playerCount = `Between ${room.min_players} and ${room.max_players} joined players are required.`;
      const maxImposters =
        participants.length >= 3 && participants.length <= 15
          ? maximumImposterCount(participants.length)
          : 0;
      if (room.imposter_count > maxImposters)
        reasons.imposterCount = `Choose between 1 and ${maxImposters} impostor${maxImposters === 1 ? "" : "s"} for this player count.`;
      if (!room.selected_task_pack_id) reasons.selectedTaskPack = "Select a published task pack.";
      const pack = room.selected_task_pack_id
        ? await trx
            .selectFrom("app.task_packs")
            .select(["id", "name", "status", "roles"])
            .where("id", "=", room.selected_task_pack_id)
            .executeTakeFirst()
        : null;
      if (room.selected_task_pack_id && (!pack || pack.status !== "published"))
        reasons.selectedTaskPack = "The selected task pack is not published.";
      const items = pack
        ? await trx
            .selectFrom("app.task_pack_items")
            .select(["id", "position", "description", "difficulty"])
            .where("task_pack_id", "=", pack.id)
            .where("is_active", "=", true)
            .orderBy("position")
            .execute()
        : [];
      const requestedTasks = {
        easy: room.easy_tasks_per_player,
        medium: room.medium_tasks_per_player,
        hard: room.hard_tasks_per_player,
      } as const;
      for (const difficulty of ["easy", "medium", "hard"] as const) {
        const available = items.filter((item) => item.difficulty === difficulty).length;
        if (available < requestedTasks[difficulty])
          reasons[`tasks.${difficulty}`] =
            `The map needs ${requestedTasks[difficulty]} active ${difficulty} task${requestedTasks[difficulty] === 1 ? "" : "s"}.`;
      }
      const roleByName = new Map((pack?.roles ?? []).map((role) => [role.name, role]));
      const roleTotal = Object.values(room.role_counts).reduce((sum, count) => sum + count, 0);
      if (Object.keys(room.role_counts).some((name) => !roleByName.has(name)))
        reasons.roleCounts = "A selected crew role is no longer available on this map.";
      if (roleTotal > participants.length - room.imposter_count)
        reasons.roleCounts = "Selected crew roles exceed the available crewmates.";
      if (Object.keys(reasons).length || !pack)
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
          game_ends_at: new Date(now.getTime() + room.task_phase_seconds * 1000),
          meeting_available_at: null,
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
            crew_role_name: null,
            crew_role_specialization: null,
            crew_role_ability: null,
          })),
        )
        .execute();
      const snapshots = items.map((item) => ({
        id: randomUUID(),
        game_id: gameId,
        source_pack_item_id: item.id,
        description_snapshot: item.description,
        position: item.position,
        difficulty_snapshot: item.difficulty,
      }));
      const plan = createAssignmentPlan(participantIds, snapshots, room.imposter_count, 0);
      for (const participantId of participantIds) {
        const chosen = (["easy", "medium", "hard"] as const).flatMap((difficulty) =>
          sampleDistinct(
            snapshots.filter((task) => task.difficulty_snapshot === difficulty),
            requestedTasks[difficulty],
          ),
        );
        plan.tasks.set(participantId, chosen);
      }
      const shuffledCrew = secureShuffle(
        participantIds.filter((id) => plan.roles.get(id) === "crew"),
      );
      const crewRoles = new Map<
        string,
        { name: string; specialization: string; ability: string }
      >();
      let roleCursor = 0;
      for (const [name, count] of Object.entries(room.role_counts)) {
        const definition = roleByName.get(name);
        if (!definition) continue;
        for (let index = 0; index < count; index += 1)
          crewRoles.set(shuffledCrew[roleCursor++], definition);
      }
      await Promise.all(
        participantIds.map((participantId) =>
          trx
            .updateTable("app.game_participants")
            .set({
              role: plan.roles.get(participantId)!,
              kill_available_at: plan.roles.get(participantId) === "imposter" ? now : null,
              crew_role_name:
                crewRoles.get(participantId)?.name ??
                (plan.roles.get(participantId) === "crew" ? "Crewmate" : null),
              crew_role_specialization:
                crewRoles.get(participantId)?.specialization ??
                (plan.roles.get(participantId) === "crew" ? "General operations" : null),
              crew_role_ability:
                crewRoles.get(participantId)?.ability ??
                (plan.roles.get(participantId) === "crew"
                  ? "Complete assigned tasks and identify impostors."
                  : null),
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
          imposter_count: room.imposter_count,
          tasks_per_crew: requestedTasks.easy + requestedTasks.medium + requestedTasks.hard,
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
    triggerType: "kill" | "task_deadline" | "user_called",
    actorParticipantId: string | null,
    reportedParticipantId: string | null,
    now: Date,
    startInVoting = false,
  ) {
    const room = await trx
      .selectFrom("app.rooms")
      .select(["discussion_seconds", "meeting_duration_seconds"])
      .where("id", "=", game.room_id)
      .executeTakeFirstOrThrow();
    const previous = await trx
      .selectFrom("app.meetings")
      .select(sql<number>`coalesce(max(sequence_number), 0)::int`.as("sequence"))
      .where("game_id", "=", game.id)
      .executeTakeFirstOrThrow();
    const meetingId = randomUUID();
    const deadline = new Date(
      now.getTime() +
        (startInVoting ? room.meeting_duration_seconds : room.discussion_seconds) * 1000,
    );
    await trx
      .insertInto("app.meetings")
      .values({
        id: meetingId,
        game_id: game.id,
        sequence_number: previous.sequence + 1,
        trigger_type: triggerType,
        trigger_actor_participant_id: actorParticipantId,
        reported_participant_id: reportedParticipantId,
        phase: startInVoting ? "voting" : "discussion",
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
    const flagged = startInVoting
      ? []
      : await trx
          .selectFrom("app.task_submissions as submission")
          .innerJoin(
            "app.task_assignments as assignment",
            "assignment.id",
            "submission.assignment_id",
          )
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
    reason: "tasks_completed" | "imposters_ejected" | "imposter_parity" | "time_expired",
    meetingId?: string,
  ): Promise<void> {
    await trx
      .updateTable("app.games")
      .set({
        phase: "game_over",
        state_version: version,
        winner,
        end_reason: reason,
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
        .orderBy("started_at", "desc")
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
        .select(["participant_id", "life_status", "role"])
        .where("game_id", "=", game.id)
        .where("participant_id", "=", input.targetParticipantId)
        .forUpdate()
        .executeTakeFirst();
      if (!target || target.life_status !== "alive" || target.role !== "crew")
        throw new ApplicationError(409, "TARGET_NOT_ELIGIBLE", "The target is not eligible.");
      await trx
        .updateTable("app.game_participants")
        .set({ life_status: "killed" })
        .where("game_id", "=", game.id)
        .where("participant_id", "=", target.participant_id)
        .execute();
      const [progress, settings] = await Promise.all([
        trx
          .selectFrom("app.task_assignments")
          .select([
            sql<number>`count(*)::int`.as("total"),
            sql<number>`count(*) filter (where status = 'completed')::int`.as("completed"),
          ])
          .where("game_id", "=", game.id)
          .where("counts_toward_progress", "=", true)
          .executeTakeFirstOrThrow(),
        trx
          .selectFrom("app.rooms")
          .select(["task_phase_seconds", "imposter_cooldown_seconds"])
          .where("id", "=", game.room_id)
          .executeTakeFirstOrThrow(),
      ]);
      const taskProgress = progress.total ? progress.completed / progress.total : 0;
      const timeProgress = Math.min(
        1,
        Math.max(0, (now.getTime() - new Date(game.started_at).getTime()) / 1000) /
          settings.task_phase_seconds,
      );
      const cooldownSeconds = killCooldownSeconds(
        settings.imposter_cooldown_seconds,
        taskProgress,
        timeProgress,
      );
      const killAvailableAt = new Date(now.getTime() + cooldownSeconds * 1000);
      await trx
        .updateTable("app.game_participants")
        .set({ kill_available_at: killAvailableAt })
        .where("game_id", "=", game.id)
        .where("participant_id", "=", principal.participantId)
        .execute();
      await trx
        .insertInto("app.eliminations")
        .values({
          id: randomUUID(),
          game_id: game.id,
          meeting_id: null,
          target_participant_id: target.participant_id,
          actor_participant_id: principal.participantId,
          type: "killed",
          occurred_at: now,
        })
        .execute();
      const nextVersion = Number(game.state_version) + 1;
      const winner = await this.winnerWith(trx, game.id);
      if (winner)
        await this.finishGame(
          trx,
          game,
          winner,
          nextVersion,
          now,
          winner === "crew" ? "imposters_ejected" : "imposter_parity",
        );
      else
        await trx
          .updateTable("app.games")
          .set({
            state_version: nextVersion,
          })
          .where("id", "=", game.id)
          .execute();
      await trx
        .insertInto("app.game_events")
        .values({
          game_id: game.id,
          state_version: nextVersion,
          type: winner ? "game.ended" : "player.killed",
          actor_participant_id: principal.participantId,
          visibility: winner ? "public" : "internal",
          payload: winner
            ? { schemaVersion: 1, winner, eliminatedParticipantId: target.participant_id }
            : { schemaVersion: 1, cooldownSeconds },
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

  async callMeeting(
    principal: ParticipantPrincipal,
    input: CallMeetingInput,
    key: string,
  ): Promise<GameSnapshotDto> {
    const result = await inTransaction(this.database, async (trx) => {
      const operation = "game.call-meeting";
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
        .orderBy("started_at", "desc")
        .forUpdate()
        .executeTakeFirst();
      if (!game) throw new ApplicationError(404, "GAME_NOT_FOUND", "No current game was found.");
      this.assertVersion(game, input.expectedStateVersion);
      if (game.phase !== "task")
        throw new ApplicationError(
          409,
          "ACTION_NOT_ALLOWED_IN_PHASE",
          "A meeting is already active.",
        );

      const now = new Date();
      const [actor, settings, completed, called, progress] = await Promise.all([
        trx
          .selectFrom("app.game_participants")
          .select(["life_status"])
          .where("game_id", "=", game.id)
          .where("participant_id", "=", principal.participantId)
          .executeTakeFirst(),
        trx
          .selectFrom("app.rooms")
          .select(["meeting_duration_seconds", "meetings_per_player", "task_phase_seconds"])
          .where("id", "=", game.room_id)
          .executeTakeFirstOrThrow(),
        trx
          .selectFrom("app.task_assignments")
          .select(sql<number>`count(*) filter (where status = 'completed')::int`.as("count"))
          .where("game_id", "=", game.id)
          .where("participant_id", "=", principal.participantId)
          .executeTakeFirstOrThrow(),
        trx
          .selectFrom("app.meetings")
          .select(sql<number>`count(*)::int`.as("count"))
          .where("game_id", "=", game.id)
          .where("trigger_type", "=", "user_called")
          .where("trigger_actor_participant_id", "=", principal.participantId)
          .executeTakeFirstOrThrow(),
        trx
          .selectFrom("app.task_assignments")
          .select([
            sql<number>`count(*)::int`.as("total"),
            sql<number>`count(*) filter (where status = 'completed')::int`.as("completed"),
          ])
          .where("game_id", "=", game.id)
          .where("counts_toward_progress", "=", true)
          .executeTakeFirstOrThrow(),
      ]);
      if (!actor || actor.life_status !== "alive")
        throw new ApplicationError(
          403,
          "PLAYER_NOT_ELIGIBLE",
          "Dead or ejected players cannot call meetings.",
        );
      if (completed.count < 1)
        throw new ApplicationError(
          403,
          "TASK_REQUIRED",
          "Complete at least one task before calling a meeting.",
        );
      if (called.count >= settings.meetings_per_player)
        throw new ApplicationError(
          409,
          "MEETING_LIMIT_REACHED",
          "You have used all of your meetings.",
        );
      if (game.meeting_available_at && new Date(game.meeting_available_at) > now)
        throw new ApplicationError(
          409,
          "MEETING_COOLDOWN",
          "The meeting cooldown has not elapsed.",
          {
            availableAt: iso(game.meeting_available_at),
          },
        );

      const taskProgress = progress.total ? progress.completed / progress.total : 0;
      const timeProgress = Math.min(
        1,
        Math.max(0, (now.getTime() - new Date(game.started_at).getTime()) / 1000) /
          settings.task_phase_seconds,
      );
      const cooldownSeconds = meetingCooldownSeconds(
        settings.meeting_duration_seconds,
        taskProgress,
        timeProgress,
      );
      const meeting = await this.createMeeting(
        trx,
        game,
        "user_called",
        principal.participantId,
        null,
        now,
        true,
      );
      const nextVersion = Number(game.state_version) + 1;
      await trx
        .updateTable("app.games")
        .set({
          phase: "voting",
          state_version: nextVersion,
          phase_started_at: now,
          phase_deadline_at: meeting.deadline,
          meeting_available_at: new Date(
            now.getTime() + (settings.meeting_duration_seconds + cooldownSeconds) * 1000,
          ),
        })
        .where("id", "=", game.id)
        .execute();
      await trx
        .insertInto("app.game_events")
        .values({
          game_id: game.id,
          state_version: nextVersion,
          type: "meeting.started",
          actor_participant_id: principal.participantId,
          visibility: "public",
          payload: { schemaVersion: 1, meetingId: meeting.id, triggerType: "user_called" },
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
  ): Promise<Date | null> {
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
        .innerJoin("app.rooms as room", "room.id", "game.room_id")
        .select([
          "item.meeting_id",
          "item.resolution",
          "meeting.phase as meeting_phase",
          "game.id as game_id",
          "game.room_id",
          "game.state_version",
          "room.meeting_voting_mode",
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
      const quorum = await this.reviewQuorum(
        trx,
        item.meeting_id,
        reviewItemId,
        item.meeting_voting_mode === "all_voted",
      );
      let phase: "review" | "voting" = "review";
      let resolution: "valid" | "invalid" | null = null;
      if (quorum.complete) {
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
        votesCast: quorum.cast,
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
    if (winner)
      await this.finishGame(
        trx,
        game,
        winner,
        nextVersion,
        now,
        winner === "crew" ? "imposters_ejected" : "imposter_parity",
      );
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
        .innerJoin("app.rooms as room", "room.id", "game.room_id")
        .select([
          "meeting.phase as meeting_phase",
          "meeting.resolved_at",
          "game.id as game_id",
          "game.room_id",
          "game.state_version",
          "room.meeting_voting_mode",
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
      const existingVote = await trx
        .selectFrom("app.ejection_votes")
        .select("id")
        .where("meeting_id", "=", meetingId)
        .where("voter_participant_id", "=", principal.participantId)
        .executeTakeFirst();
      if (existingVote)
        throw new ApplicationError(
          409,
          "VOTE_ALREADY_CAST",
          "Your vote is locked for this meeting.",
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
        .execute();
      const quorum = await this.ejectionQuorum(
        trx,
        meetingId,
        meeting.meeting_voting_mode === "all_voted",
      );
      let resolution: Awaited<ReturnType<GameService["resolveVoting"]>> | null = null;
      if (quorum.complete) resolution = await this.resolveVoting(trx, game, meetingId, now);
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
        votesCast: quorum.cast,
        resolved: Boolean(resolution),
        winner: resolution?.winner ?? null,
        stateVersion,
      };
      await this.remember(trx, principal.participantId, key, operation, input, response);
      return { response, changed: true, roomId: game.room_id, gameId: game.id };
    });
    if (result.changed)
      this.events.gameChanged(result.roomId, result.gameId, Number(result.response.stateVersion));
    return result.response;
  }

  async handleParticipantDisconnected(roomId: string, participantId: string): Promise<void> {
    const changed = await inTransaction(this.database, async (trx) => {
      const game = await trx
        .selectFrom("app.games as game")
        .innerJoin("app.rooms as room", "room.id", "game.room_id")
        .selectAll("game")
        .select("room.meeting_voting_mode")
        .where("game.room_id", "=", roomId)
        .where("game.phase", "in", ["review", "voting"])
        .where("room.meeting_voting_mode", "=", "all_voted")
        .orderBy("game.started_at", "desc")
        .forUpdate()
        .executeTakeFirst();
      if (!game) return null;
      const participant = await trx
        .selectFrom("app.participants")
        .select("disconnected_at")
        .where("id", "=", participantId)
        .where("room_id", "=", roomId)
        .executeTakeFirst();
      if (!participant?.disconnected_at) return null;
      const meeting = await trx
        .selectFrom("app.meetings")
        .select("id")
        .where("game_id", "=", game.id)
        .where("resolved_at", "is", null)
        .executeTakeFirst();
      if (!meeting) return null;
      const eligible = await trx
        .selectFrom("app.meeting_eligible_voters")
        .select("participant_id")
        .where("meeting_id", "=", meeting.id)
        .where("participant_id", "=", participantId)
        .executeTakeFirst();
      if (!eligible) return null;

      const now = new Date();
      const nextVersion = Number(game.state_version) + 1;
      if (game.phase === "voting") {
        const quorum = await this.ejectionQuorum(trx, meeting.id, true);
        if (!quorum.complete) return { gameId: game.id, stateVersion: Number(game.state_version) };
        const resolution = await this.resolveVoting(trx, game, meeting.id, now);
        await trx
          .insertInto("app.game_events")
          .values({
            game_id: game.id,
            state_version: nextVersion,
            type: resolution.winner ? "game.ended" : "meeting.resolved",
            actor_participant_id: null,
            visibility: "public",
            payload: {
              schemaVersion: 1,
              meetingId: meeting.id,
              reason: "connected_voters_complete",
              ejectedParticipantId: resolution.ejectedParticipantId,
              winner: resolution.winner,
            },
          })
          .execute();
      } else {
        const review = await trx
          .selectFrom("app.evidence_review_items")
          .select("id")
          .where("meeting_id", "=", meeting.id)
          .where("resolution", "is", null)
          .orderBy("position")
          .executeTakeFirst();
        if (!review) return null;
        const quorum = await this.reviewQuorum(trx, meeting.id, review.id, true);
        if (!quorum.complete) return { gameId: game.id, stateVersion: Number(game.state_version) };
        const resolution = await this.resolveCurrentReview(trx, game, meeting.id, review.id, now);
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
            type: "review.resolved",
            actor_participant_id: null,
            visibility: "public",
            payload: {
              schemaVersion: 1,
              meetingId: meeting.id,
              reviewItemId: review.id,
              reason: "connected_voters_complete",
              resolution: resolution.resolution,
            },
          })
          .execute();
      }
      return { gameId: game.id, stateVersion: nextVersion };
    });
    if (changed) this.events.gameChanged(roomId, changed.gameId, changed.stateVersion);
  }

  async runDueTransitions(limit = 25): Promise<number> {
    let advanced = 0;
    for (; advanced < limit; advanced += 1) {
      const candidate = await this.database
        .selectFrom("app.games")
        .select("id")
        .where((eb) =>
          eb.or([
            eb("phase_deadline_at", "<=", new Date()),
            eb.and([eb("phase", "=", "voting"), eb("phase_deadline_at", "is", null)]),
          ]),
        )
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
      if (!game) return null;
      if (game.phase_deadline_at && new Date(game.phase_deadline_at) > now) return null;
      // Older all-voted meetings had no deadline. Treat those as due so a
      // missing or disconnected voter cannot leave an existing room stuck.
      if (!game.phase_deadline_at && game.phase !== "voting") return null;
      const nextVersion = Number(game.state_version) + 1;
      let eventType = "meeting.phase_changed";
      let payload: Record<string, unknown> = { schemaVersion: 1 };
      if (game.phase === "task") {
        const winner = (await this.winnerWith(trx, game.id)) ?? "imposters";
        await this.finishGame(trx, game, winner, nextVersion, now, "time_expired");
        eventType = "game.ended";
        payload = { schemaVersion: 1, winner, reason: "time_expired" };
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
        const deadline = game.game_ends_at ? new Date(game.game_ends_at) : now;
        if (deadline <= now) {
          await this.finishGame(trx, game, "imposters", nextVersion, now, "time_expired");
          eventType = "game.ended";
          payload = { schemaVersion: 1, winner: "imposters", reason: "time_expired" };
        } else {
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
        }
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
