import { createHash, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { sql, type Transaction } from "kysely";

import type { Database, DatabaseSchema } from "../../infrastructure/database/database.js";
import { inTransaction } from "../../infrastructure/database/transaction.js";
import type { ParticipantPrincipal } from "../rooms/types.js";
import { ApplicationError } from "../../shared/errors/application-error.js";
import { capabilitiesFor, playerBand } from "./domain.js";
import { createAssignmentPlan } from "./random.js";
import type { GameSnapshotDto } from "./types.js";

type Executor = Database | Transaction<DatabaseSchema>;

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

    const [participants, assignments, progress] = await Promise.all([
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
}
