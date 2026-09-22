import { createHash, createHmac, randomInt, randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { sql, type Transaction } from "kysely";

import type { AppConfig } from "../../infrastructure/configuration/config.js";
import type { Database, DatabaseSchema } from "../../infrastructure/database/database.js";
import { inTransaction } from "../../infrastructure/database/transaction.js";
import { ApplicationError } from "../../shared/errors/application-error.js";
import { hashSecret } from "../../shared/security/tokens.js";
import { maximumImposterCount } from "../games/domain.js";
import {
  normalizeNickname,
  type RoomCreationInput,
  type RoomMembershipInput,
  type RoomSettingsInput,
} from "./schemas.js";
import type {
  ParticipantPrincipal,
  PresenceUpdate,
  RoomSnapshotDto,
  SessionIssueDto,
} from "./types.js";

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
// Completed rooms keep their sessions alive so players can inspect results,
// replay, or leave. Only an expired room is no longer authenticatable.
const TERMINAL_STATUSES = ["expired"] as const;

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function roomCode(): string {
  return Array.from({ length: 6 }, () => ROOM_ALPHABET[randomInt(ROOM_ALPHABET.length)]).join("");
}

function bodyHash(operation: string, body: unknown): string {
  return createHash("sha256").update(JSON.stringify({ operation, body })).digest("base64url");
}

export class RoomEvents extends EventEmitter {
  roomChanged(roomId: string): void {
    this.emit("room.changed", roomId);
  }
  presenceChanged(update: PresenceUpdate): void {
    this.emit("presence.changed", update);
  }
  sessionRevoked(sessionId: string, reason: string): void {
    this.emit("session.revoked", sessionId, reason);
  }
}

type Executor = Database | Transaction<DatabaseSchema>;

interface StoredReplay<T> {
  response: T;
  sessionId: string | null;
}

export class RoomService {
  readonly events = new RoomEvents();
  private readonly publicAttempts = new Map<string, number[]>();

  constructor(
    private readonly database: Database,
    private readonly config: AppConfig,
  ) {}

  private throttlePublic(scope: string): void {
    const now = Date.now();
    const recent = (this.publicAttempts.get(scope) ?? []).filter(
      (attempt) => now - attempt < 60_000,
    );
    if (recent.length >= 30)
      throw new ApplicationError(
        429,
        "RATE_LIMITED",
        "Too many room requests. Please retry later.",
        { retryAfterSeconds: 60 },
      );
    recent.push(now);
    this.publicAttempts.set(scope, recent);
    if (this.publicAttempts.size > 10_000)
      for (const [key, attempts] of this.publicAttempts)
        if (!attempts.some((attempt) => now - attempt < 60_000)) this.publicAttempts.delete(key);
  }

  private sessionToken(sessionId: string, idempotencyKey: string): string {
    return createHmac("sha256", this.config.participantSessionTokenPepper)
      .update(`participant-session:${sessionId}:${idempotencyKey}`)
      .digest("base64url");
  }

  private async replay<T>(
    trx: Transaction<DatabaseSchema>,
    scope: string,
    key: string,
    operation: string,
    body: unknown,
  ): Promise<StoredReplay<T> | null> {
    await sql`select pg_advisory_xact_lock(hashtextextended(${`${scope}:${key}`}, 0))`.execute(trx);
    const existing = await trx
      .selectFrom("app.room_idempotency_records")
      .select(["operation", "request_hash", "response_body", "session_id", "expires_at"])
      .where("scope", "=", scope)
      .where("key", "=", key)
      .executeTakeFirst();
    if (!existing) return null;
    if (new Date(existing.expires_at).getTime() <= Date.now()) {
      await trx
        .deleteFrom("app.room_idempotency_records")
        .where("scope", "=", scope)
        .where("key", "=", key)
        .execute();
      return null;
    }
    if (existing.operation !== operation || existing.request_hash !== bodyHash(operation, body))
      throw new ApplicationError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "The Idempotency-Key was already used for a different request.",
      );
    return { response: existing.response_body as unknown as T, sessionId: existing.session_id };
  }

  private async remember(
    trx: Transaction<DatabaseSchema>,
    scope: string,
    key: string,
    operation: string,
    body: unknown,
    response: unknown,
    sessionId: string | null = null,
  ): Promise<void> {
    await trx
      .insertInto("app.room_idempotency_records")
      .values({
        scope,
        key,
        operation,
        request_hash: bodyHash(operation, body),
        response_body: response as Record<string, unknown>,
        session_id: sessionId,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .execute();
  }

  private async snapshotWith(
    executor: Executor,
    principal: ParticipantPrincipal,
  ): Promise<RoomSnapshotDto> {
    const room = await executor
      .selectFrom("app.rooms as rooms")
      .leftJoin("app.task_packs as packs", "packs.id", "rooms.selected_task_pack_id")
      .leftJoin("app.games as games", "games.room_id", "rooms.id")
      .select([
        "rooms.id",
        "rooms.code",
        "rooms.status",
        "rooms.host_participant_id",
        "rooms.max_players",
        "rooms.min_players",
        "rooms.imposter_count",
        "rooms.easy_tasks_per_player",
        "rooms.medium_tasks_per_player",
        "rooms.hard_tasks_per_player",
        "rooms.role_counts",
        "rooms.task_phase_seconds",
        "rooms.meetings_per_player",
        "rooms.meeting_duration_seconds",
        "rooms.meeting_voting_mode",
        "rooms.vote_visibility",
        "rooms.evidence_visibility",
        "rooms.meeting_task_requirement",
        "rooms.meeting_cooldown_seconds",
        "rooms.imposter_cooldown_seconds",
        "rooms.discussion_seconds",
        "rooms.review_seconds",
        "rooms.voting_seconds",
        "rooms.expires_at",
        "packs.id as pack_id",
        "packs.name as pack_name",
        "packs.revision as pack_revision",
        "packs.roles as pack_roles",
        "games.id as game_id",
      ])
      .where("rooms.id", "=", principal.roomId)
      .orderBy("games.started_at", "desc")
      .executeTakeFirst();
    if (!room) throw new ApplicationError(404, "NOT_FOUND", "The room was not found.");
    const packTaskCounts = room.pack_id
      ? await executor
          .selectFrom("app.task_pack_items")
          .select([
            sql<number>`count(*) filter (where difficulty = 'easy' and is_active)::int`.as("easy"),
            sql<number>`count(*) filter (where difficulty = 'medium' and is_active)::int`.as(
              "medium",
            ),
            sql<number>`count(*) filter (where difficulty = 'hard' and is_active)::int`.as("hard"),
          ])
          .where("task_pack_id", "=", room.pack_id)
          .executeTakeFirstOrThrow()
      : { easy: 0, medium: 0, hard: 0 };
    const participants = await executor
      .selectFrom("app.participants")
      .select(["id", "nickname", "joined_at", "disconnected_at"])
      .where("room_id", "=", principal.roomId)
      .where("membership_status", "=", "joined")
      .orderBy("joined_at")
      .orderBy("id")
      .execute();
    const self = participants.find((participant) => participant.id === principal.participantId);
    if (!self)
      throw new ApplicationError(
        401,
        "SESSION_INVALID",
        "The participant session is no longer active.",
      );
    const isHost = room.host_participant_id === self.id;
    return {
      id: room.id,
      code: room.code,
      status: room.status,
      minPlayers: room.min_players,
      maxPlayers: room.max_players,
      settings: {
        selectedTaskPack:
          room.pack_id && room.pack_name && room.pack_revision
            ? {
                id: room.pack_id,
                name: room.pack_name,
                revision: room.pack_revision,
                roles: room.pack_roles ?? [],
                difficultyTaskCounts: packTaskCounts,
              }
            : null,
        taskPhaseSeconds: room.task_phase_seconds,
        meetingsPerPlayer: room.meetings_per_player,
        meetingDurationSeconds: room.meeting_duration_seconds,
        meetingVotingMode: room.meeting_voting_mode,
        voteVisibility: room.vote_visibility,
        evidenceVisibility: room.evidence_visibility,
        meetingTaskRequirement: room.meeting_task_requirement,
        meetingCooldownSeconds: room.meeting_cooldown_seconds,
        imposterCooldownSeconds: room.imposter_cooldown_seconds,
        estimatedMeetingCooldownSeconds: room.meeting_cooldown_seconds,
        imposterCount: room.imposter_count,
        allowedImposterCounts: Array.from(
          { length: maximumImposterCount(Math.max(3, participants.length)) },
          (_, index) => index + 1,
        ),
        taskCounts: {
          easy: room.easy_tasks_per_player,
          medium: room.medium_tasks_per_player,
          hard: room.hard_tasks_per_player,
        },
        roleCounts: room.role_counts,
      },
      participants: participants.map((participant) => ({
        id: participant.id,
        nickname: participant.nickname,
        isHost: participant.id === room.host_participant_id,
        presence: participant.disconnected_at ? "away" : "connected",
        joinedAt: iso(participant.joined_at),
      })),
      self: {
        participantId: self.id,
        nickname: self.nickname,
        isHost,
        capabilities:
          isHost && room.status === "lobby"
            ? ["change_settings", "start_game", "leave_room"]
            : room.status === "lobby"
              ? ["leave_room"]
              : [],
      },
      expiresAt: iso(room.expires_at),
      gameId: room.status === "lobby" ? null : room.game_id,
    };
  }

  snapshot(principal: ParticipantPrincipal): Promise<RoomSnapshotDto> {
    return this.snapshotWith(this.database, principal);
  }

  private async issueIn(
    trx: Transaction<DatabaseSchema>,
    participantId: string,
    sessionId: string,
    key: string,
    roomExpiry: Date | string,
  ): Promise<{ token: string; expiresAt: Date }> {
    const expiresAt = new Date(
      Math.min(
        Date.now() + this.config.participantSessionTtlSeconds * 1000,
        new Date(roomExpiry).getTime(),
      ),
    );
    const token = this.sessionToken(sessionId, key);
    await trx
      .insertInto("app.participant_sessions")
      .values({
        id: sessionId,
        participant_id: participantId,
        token_hash: hashSecret(token, this.config.participantSessionTokenPepper),
        expires_at: expiresAt,
        last_used_at: null,
        revoked_at: null,
      })
      .execute();
    return { token, expiresAt };
  }

  async createRoom(
    input: RoomCreationInput | (RoomMembershipInput & { minPlayers?: number; maxPlayers?: number }),
    key: string,
    requestScope: string,
  ): Promise<SessionIssueDto> {
    this.throttlePublic(requestScope);
    const normalized = normalizeNickname(input.nickname);
    const minPlayers = input.minPlayers ?? 3;
    const maxPlayers = input.maxPlayers ?? 12;
    const replayInput = { ...normalized, minPlayers, maxPlayers };
    for (let attempt = 0; attempt < 8; attempt += 1) {
      try {
        const result = await inTransaction(this.database, async (trx) => {
          const operation = "room.create";
          const replayed = await this.replay<Omit<SessionIssueDto, "sessionToken">>(
            trx,
            requestScope,
            key,
            operation,
            replayInput,
          );
          if (replayed) {
            if (!replayed.sessionId)
              throw new ApplicationError(
                409,
                "SESSION_ROTATION_CONFLICT",
                "The original session can no longer be issued.",
              );
            return {
              ...replayed.response,
              sessionToken: this.sessionToken(replayed.sessionId, key),
            };
          }
          const code = roomCode();
          const cooling = new Date(Date.now() - this.config.roomCodeCooldownSeconds * 1000);
          const recentlyUsed = await trx
            .selectFrom("app.rooms")
            .select("id")
            .where("code", "=", code)
            .where("created_at", ">", cooling)
            .executeTakeFirst();
          if (recentlyUsed)
            throw Object.assign(new Error("room code collision"), { code: "ROOM_CODE_COLLISION" });
          const now = new Date();
          const roomId = randomUUID();
          const participantId = randomUUID();
          const sessionId = randomUUID();
          const expiresAt = new Date(now.getTime() + this.config.roomLobbyTtlSeconds * 1000);
          await trx
            .insertInto("app.rooms")
            .values({
              id: roomId,
              code,
              status: "lobby",
              host_participant_id: null,
              selected_task_pack_id: null,
              min_players: minPlayers,
              max_players: maxPlayers,
              imposter_count: 1,
              tasks_per_crew: 3,
              easy_tasks_per_player: 0,
              medium_tasks_per_player: 3,
              hard_tasks_per_player: 0,
              role_counts: {},
              task_phase_seconds: 900,
              discussion_seconds: 90,
              review_seconds: 60,
              voting_seconds: 60,
              meetings_per_player: 2,
              meeting_duration_seconds: 90,
              meeting_voting_mode: "timed",
              vote_visibility: "private",
              evidence_visibility: "public",
              meeting_task_requirement: "one",
              meeting_cooldown_seconds: 90,
              imposter_cooldown_seconds: 60,
              last_activity_at: now,
              expires_at: expiresAt,
            })
            .execute();
          await trx
            .insertInto("app.participants")
            .values({
              id: participantId,
              room_id: roomId,
              nickname: normalized.display,
              normalized_nickname: normalized.normalized,
              membership_status: "joined",
              last_seen_at: now,
              disconnected_at: null,
            })
            .execute();
          await trx
            .updateTable("app.rooms")
            .set({ host_participant_id: participantId })
            .where("id", "=", roomId)
            .execute();
          const issued = await this.issueIn(trx, participantId, sessionId, key, expiresAt);
          const principal = { participantId, roomId, sessionId };
          const snapshot = await this.snapshotWith(trx, principal);
          const safeResponse = {
            room: snapshot,
            participant: snapshot.self,
            sessionExpiresAt: issued.expiresAt.toISOString(),
          };
          await this.remember(
            trx,
            requestScope,
            key,
            operation,
            replayInput,
            safeResponse,
            sessionId,
          );
          return { ...safeResponse, sessionToken: issued.token };
        });
        this.events.roomChanged(result.room.id);
        return result;
      } catch (error) {
        const code = (error as { code?: string }).code;
        if (code === "23505" || code === "ROOM_CODE_COLLISION") continue;
        throw error;
      }
    }
    throw new ApplicationError(
      503,
      "ROOM_CODE_UNAVAILABLE",
      "A room code could not be allocated. Please retry.",
    );
  }

  async joinRoom(
    codeInput: string,
    input: RoomMembershipInput,
    key: string,
    requestScope: string,
  ): Promise<SessionIssueDto> {
    this.throttlePublic(requestScope.slice(0, -7));
    const code = codeInput.toUpperCase();
    const normalized = normalizeNickname(input.nickname);
    try {
      const result = await inTransaction(this.database, async (trx) => {
        const operation = `room.join:${code}`;
        const replayed = await this.replay<Omit<SessionIssueDto, "sessionToken">>(
          trx,
          requestScope,
          key,
          operation,
          normalized,
        );
        if (replayed) {
          if (!replayed.sessionId)
            throw new ApplicationError(
              409,
              "SESSION_ROTATION_CONFLICT",
              "The original session can no longer be issued.",
            );
          return { ...replayed.response, sessionToken: this.sessionToken(replayed.sessionId, key) };
        }
        const room = await trx
          .selectFrom("app.rooms")
          .selectAll()
          .where("code", "=", code)
          .where("status", "=", "lobby")
          .forUpdate()
          .executeTakeFirst();
        if (!room || new Date(room.expires_at).getTime() <= Date.now())
          throw new ApplicationError(404, "ROOM_NOT_FOUND", "The room is unavailable.");
        const count = await trx
          .selectFrom("app.participants")
          .select(sql<number>`count(*)::int`.as("count"))
          .where("room_id", "=", room.id)
          .where("membership_status", "=", "joined")
          .executeTakeFirstOrThrow();
        if (count.count >= room.max_players)
          throw new ApplicationError(409, "ROOM_FULL", "The room is full.");
        const nicknameTaken = await trx
          .selectFrom("app.participants")
          .select("id")
          .where("room_id", "=", room.id)
          .where("normalized_nickname", "=", normalized.normalized)
          .where("membership_status", "=", "joined")
          .executeTakeFirst();
        if (nicknameTaken)
          throw new ApplicationError(
            409,
            "NICKNAME_TAKEN",
            "That nickname is already in use in this room.",
          );
        const participantId = randomUUID();
        const sessionId = randomUUID();
        const now = new Date();
        const roomExpiresAt = new Date(now.getTime() + this.config.roomLobbyTtlSeconds * 1000);
        await trx
          .insertInto("app.participants")
          .values({
            id: participantId,
            room_id: room.id,
            nickname: normalized.display,
            normalized_nickname: normalized.normalized,
            membership_status: "joined",
            last_seen_at: now,
            disconnected_at: null,
          })
          .execute();
        await trx
          .updateTable("app.rooms")
          .set({ last_activity_at: now, expires_at: roomExpiresAt })
          .where("id", "=", room.id)
          .execute();
        const issued = await this.issueIn(trx, participantId, sessionId, key, roomExpiresAt);
        const snapshot = await this.snapshotWith(trx, {
          participantId,
          roomId: room.id,
          sessionId,
        });
        const safeResponse = {
          room: snapshot,
          participant: snapshot.self,
          sessionExpiresAt: issued.expiresAt.toISOString(),
        };
        await this.remember(trx, requestScope, key, operation, normalized, safeResponse, sessionId);
        return { ...safeResponse, sessionToken: issued.token };
      });
      this.events.roomChanged(result.room.id);
      return result;
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        throw new ApplicationError(
          409,
          "NICKNAME_TAKEN",
          "That nickname is already in use in this room.",
        );
      throw error;
    }
  }

  async authenticate(token: string): Promise<ParticipantPrincipal | null> {
    const tokenHash = hashSecret(token, this.config.participantSessionTokenPepper);
    const row = await this.database
      .selectFrom("app.participant_sessions as sessions")
      .innerJoin("app.participants as participants", "participants.id", "sessions.participant_id")
      .innerJoin("app.rooms as rooms", "rooms.id", "participants.room_id")
      .select([
        "sessions.id as sessionId",
        "participants.id as participantId",
        "rooms.id as roomId",
        "sessions.last_used_at",
      ])
      .where("sessions.token_hash", "=", tokenHash)
      .where("sessions.expires_at", ">", new Date())
      .where((eb) =>
        eb.or([eb("sessions.revoked_at", "is", null), eb("sessions.revoked_at", ">", new Date())]),
      )
      .where("participants.membership_status", "=", "joined")
      .where("rooms.status", "not in", TERMINAL_STATUSES)
      .where("rooms.expires_at", ">", new Date())
      .executeTakeFirst();
    if (!row) return null;
    if (!row.last_used_at || Date.now() - new Date(row.last_used_at).getTime() > 60_000)
      await this.database
        .updateTable("app.participant_sessions")
        .set({ last_used_at: new Date() })
        .where("id", "=", row.sessionId)
        .execute();
    return { participantId: row.participantId, roomId: row.roomId, sessionId: row.sessionId };
  }

  async updateSettings(
    principal: ParticipantPrincipal,
    input: RoomSettingsInput,
    key: string,
  ): Promise<RoomSnapshotDto> {
    const snapshot = await inTransaction(this.database, async (trx) => {
      const operation = "room.settings";
      const replayed = await this.replay<RoomSnapshotDto>(
        trx,
        principal.participantId,
        key,
        operation,
        input,
      );
      if (replayed) return replayed.response;
      const room = await trx
        .selectFrom("app.rooms")
        .selectAll()
        .where("id", "=", principal.roomId)
        .forUpdate()
        .executeTakeFirst();
      if (!room) throw new ApplicationError(404, "NOT_FOUND", "The room was not found.");
      if (room.host_participant_id !== principal.participantId)
        throw new ApplicationError(403, "FORBIDDEN", "Only the host can change room settings.");
      if (room.status !== "lobby")
        throw new ApplicationError(
          409,
          "ROOM_NOT_IN_LOBBY",
          "Room settings can only be changed in the lobby.",
        );
      if (input.selectedTaskPackId) {
        const pack = await trx
          .selectFrom("app.task_packs")
          .select("id")
          .where("id", "=", input.selectedTaskPackId)
          .where("status", "=", "published")
          .executeTakeFirst();
        if (!pack)
          throw new ApplicationError(
            422,
            "VALIDATION_FAILED",
            "The selected task pack is not published.",
          );
      }
      const joined = await trx
        .selectFrom("app.participants")
        .select(sql<number>`count(*)::int`.as("count"))
        .where("room_id", "=", room.id)
        .where("membership_status", "=", "joined")
        .executeTakeFirstOrThrow();
      if (
        input.imposterCount !== undefined &&
        input.imposterCount > maximumImposterCount(Math.max(3, joined.count))
      )
        throw new ApplicationError(
          422,
          "VALIDATION_FAILED",
          "That many impostors would leave too few crewmates for the current player count.",
          { maximum: maximumImposterCount(Math.max(3, joined.count)) },
        );
      if (input.taskCounts !== undefined) {
        const requested = input.taskCounts;
        const packId =
          input.selectedTaskPackId === undefined
            ? room.selected_task_pack_id
            : input.selectedTaskPackId;
        if (!packId)
          throw new ApplicationError(
            422,
            "VALIDATION_FAILED",
            "Choose a map before configuring task quantities.",
          );
        const available = await trx
          .selectFrom("app.task_pack_items")
          .select([
            sql<number>`count(*) filter (where difficulty = 'easy' and is_active)::int`.as("easy"),
            sql<number>`count(*) filter (where difficulty = 'medium' and is_active)::int`.as(
              "medium",
            ),
            sql<number>`count(*) filter (where difficulty = 'hard' and is_active)::int`.as("hard"),
          ])
          .where("task_pack_id", "=", packId)
          .executeTakeFirstOrThrow();
        const unavailable = (["easy", "medium", "hard"] as const).find(
          (difficulty) => requested[difficulty] > available[difficulty],
        );
        if (unavailable)
          throw new ApplicationError(
            422,
            "VALIDATION_FAILED",
            `This map only has ${available[unavailable]} active ${unavailable} task${available[unavailable] === 1 ? "" : "s"}.`,
            { difficulty: unavailable, available: available[unavailable] },
          );
      }
      if (input.roleCounts !== undefined) {
        const packId =
          input.selectedTaskPackId === undefined
            ? room.selected_task_pack_id
            : input.selectedTaskPackId;
        const pack = packId
          ? await trx
              .selectFrom("app.task_packs")
              .select("roles")
              .where("id", "=", packId)
              .executeTakeFirst()
          : null;
        const names = new Set((pack?.roles ?? []).map((role) => role.name));
        if (Object.keys(input.roleCounts).some((name) => !names.has(name)))
          throw new ApplicationError(
            422,
            "VALIDATION_FAILED",
            "Role counts contain a role that is not part of the selected map.",
          );
        const imposters = input.imposterCount ?? room.imposter_count;
        if (
          Object.values(input.roleCounts).reduce((sum, count) => sum + count, 0) >
          Math.max(0, joined.count - imposters)
        )
          throw new ApplicationError(
            422,
            "VALIDATION_FAILED",
            "Assigned crew roles exceed the available crewmates.",
          );
      }
      await trx
        .updateTable("app.rooms")
        .set({
          ...(input.selectedTaskPackId !== undefined
            ? { selected_task_pack_id: input.selectedTaskPackId }
            : {}),
          ...(input.taskPhaseSeconds !== undefined
            ? { task_phase_seconds: input.taskPhaseSeconds }
            : {}),
          ...(input.meetingsPerPlayer !== undefined
            ? { meetings_per_player: input.meetingsPerPlayer }
            : {}),
          ...(input.meetingDurationSeconds !== undefined
            ? { meeting_duration_seconds: input.meetingDurationSeconds }
            : {}),
          ...(input.meetingVotingMode !== undefined
            ? { meeting_voting_mode: input.meetingVotingMode }
            : {}),
          ...(input.voteVisibility !== undefined ? { vote_visibility: input.voteVisibility } : {}),
          ...(input.evidenceVisibility !== undefined
            ? { evidence_visibility: input.evidenceVisibility }
            : {}),
          ...(input.meetingTaskRequirement !== undefined
            ? { meeting_task_requirement: input.meetingTaskRequirement }
            : {}),
          ...(input.meetingCooldownSeconds !== undefined
            ? { meeting_cooldown_seconds: input.meetingCooldownSeconds }
            : {}),
          ...(input.imposterCooldownSeconds !== undefined
            ? { imposter_cooldown_seconds: input.imposterCooldownSeconds }
            : {}),
          ...(input.imposterCount !== undefined ? { imposter_count: input.imposterCount } : {}),
          ...(input.taskCounts !== undefined
            ? {
                easy_tasks_per_player: input.taskCounts.easy,
                medium_tasks_per_player: input.taskCounts.medium,
                hard_tasks_per_player: input.taskCounts.hard,
                tasks_per_crew:
                  input.taskCounts.easy + input.taskCounts.medium + input.taskCounts.hard,
              }
            : {}),
          ...(input.roleCounts !== undefined ? { role_counts: input.roleCounts } : {}),
          ...(input.selectedTaskPackId !== undefined ? { role_counts: {} } : {}),
          last_activity_at: new Date(),
          expires_at: new Date(Date.now() + this.config.roomLobbyTtlSeconds * 1000),
        })
        .where("id", "=", principal.roomId)
        .execute();
      const response = await this.snapshotWith(trx, principal);
      await this.remember(trx, principal.participantId, key, operation, input, response);
      return response;
    });
    this.events.roomChanged(principal.roomId);
    return snapshot;
  }

  async replayRoom(principal: ParticipantPrincipal, key: string): Promise<RoomSnapshotDto> {
    const snapshot = await inTransaction(this.database, async (trx) => {
      const operation = "room.replay";
      const replayed = await this.replay<RoomSnapshotDto>(
        trx,
        principal.participantId,
        key,
        operation,
        {},
      );
      if (replayed) return replayed.response;
      const room = await trx
        .selectFrom("app.rooms")
        .select(["id", "status"])
        .where("id", "=", principal.roomId)
        .forUpdate()
        .executeTakeFirst();
      if (!room) throw new ApplicationError(404, "NOT_FOUND", "The room was not found.");
      const participant = await trx
        .selectFrom("app.participants")
        .select("id")
        .where("id", "=", principal.participantId)
        .where("room_id", "=", room.id)
        .where("membership_status", "=", "joined")
        .executeTakeFirst();
      if (!participant)
        throw new ApplicationError(
          401,
          "SESSION_INVALID",
          "Your room session is no longer active.",
        );
      if (room.status === "active") {
        const game = await trx
          .selectFrom("app.games")
          .select("phase")
          .where("room_id", "=", room.id)
          .orderBy("started_at", "desc")
          .executeTakeFirst();
        if (game && !["game_over", "abandoned"].includes(game.phase))
          throw new ApplicationError(
            409,
            "GAME_NOT_FINISHED",
            "The current game has not finished.",
          );
      }
      if (room.status !== "lobby") {
        await trx
          .updateTable("app.rooms")
          .set({
            status: "lobby",
            last_activity_at: new Date(),
            expires_at: new Date(Date.now() + this.config.roomLobbyTtlSeconds * 1000),
          })
          .where("id", "=", room.id)
          .execute();
      }
      const response = await this.snapshotWith(trx, principal);
      await this.remember(trx, principal.participantId, key, operation, {}, response);
      return response;
    });
    this.events.roomChanged(principal.roomId);
    return snapshot;
  }

  async leave(principal: ParticipantPrincipal, key: string): Promise<{ left: true }> {
    const participantSessions = await this.database
      .selectFrom("app.participant_sessions")
      .select("id")
      .where("participant_id", "=", principal.participantId)
      .where((eb) => eb.or([eb("revoked_at", "is", null), eb("revoked_at", ">", new Date())]))
      .execute();
    const response = await inTransaction(this.database, async (trx) => {
      const operation = "room.leave";
      const replayed = await this.replay<{ left: true }>(
        trx,
        principal.participantId,
        key,
        operation,
        {},
      );
      if (replayed) return replayed.response;
      const room = await trx
        .selectFrom("app.rooms")
        .selectAll()
        .where("id", "=", principal.roomId)
        .forUpdate()
        .executeTakeFirst();
      if (!room) throw new ApplicationError(404, "NOT_FOUND", "The room was not found.");
      if (room.status === "active")
        throw new ApplicationError(
          409,
          "CANNOT_LEAVE_ACTIVE_GAME",
          "A participant cannot permanently leave an active game.",
        );
      await trx
        .updateTable("app.participants")
        .set({ membership_status: "left", disconnected_at: new Date() })
        .where("id", "=", principal.participantId)
        .execute();
      await trx
        .updateTable("app.participant_sessions")
        .set({ revoked_at: new Date() })
        .where("participant_id", "=", principal.participantId)
        .execute();
      const next = await trx
        .selectFrom("app.participants")
        .select("id")
        .where("room_id", "=", principal.roomId)
        .where("membership_status", "=", "joined")
        .orderBy("joined_at")
        .orderBy("id")
        .executeTakeFirst();
      await trx
        .updateTable("app.rooms")
        .set(
          next
            ? {
                host_participant_id: next.id,
                last_activity_at: new Date(),
                expires_at: new Date(Date.now() + this.config.roomLobbyTtlSeconds * 1000),
              }
            : {
                host_participant_id: null,
                status: "expired",
                expires_at: new Date(),
                last_activity_at: new Date(),
              },
        )
        .where("id", "=", principal.roomId)
        .execute();
      const result = { left: true } as const;
      await this.remember(trx, principal.participantId, key, operation, {}, result);
      return result;
    });
    for (const session of participantSessions)
      this.events.sessionRevoked(session.id, "participant_left");
    this.events.roomChanged(principal.roomId);
    return response;
  }

  async rotate(
    principal: ParticipantPrincipal,
    key: string,
  ): Promise<{ sessionToken: string; sessionExpiresAt: string }> {
    const result = await inTransaction(this.database, async (trx) => {
      const operation = "participant_session.rotate";
      const replayed = await this.replay<{ sessionExpiresAt: string }>(
        trx,
        principal.participantId,
        key,
        operation,
        {},
      );
      if (replayed) {
        if (!replayed.sessionId)
          throw new ApplicationError(
            409,
            "SESSION_ROTATION_CONFLICT",
            "The session rotation could not be replayed.",
          );
        return {
          ...replayed.response,
          sessionToken: this.sessionToken(replayed.sessionId, key),
          newSessionId: replayed.sessionId,
        };
      }
      const current = await trx
        .selectFrom("app.participant_sessions")
        .selectAll()
        .where("id", "=", principal.sessionId)
        .forUpdate()
        .executeTakeFirst();
      if (!current || (current.revoked_at && new Date(current.revoked_at).getTime() <= Date.now()))
        throw new ApplicationError(
          409,
          "SESSION_ROTATION_CONFLICT",
          "The session was already rotated or revoked.",
        );
      const room = await trx
        .selectFrom("app.rooms")
        .select("expires_at")
        .where("id", "=", principal.roomId)
        .executeTakeFirstOrThrow();
      const newSessionId = randomUUID();
      const issued = await this.issueIn(
        trx,
        principal.participantId,
        newSessionId,
        key,
        room.expires_at,
      );
      await trx
        .updateTable("app.participant_sessions")
        .set({ revoked_at: new Date(Date.now() + 30_000) })
        .where("id", "=", principal.sessionId)
        .execute();
      const safeResponse = { sessionExpiresAt: issued.expiresAt.toISOString() };
      await this.remember(
        trx,
        principal.participantId,
        key,
        operation,
        {},
        safeResponse,
        newSessionId,
      );
      return { ...safeResponse, sessionToken: issued.token, newSessionId };
    });
    this.events.sessionRevoked(principal.sessionId, "session_rotated");
    return { sessionToken: result.sessionToken, sessionExpiresAt: result.sessionExpiresAt };
  }

  async revoke(principal: ParticipantPrincipal): Promise<void> {
    await this.database
      .updateTable("app.participant_sessions")
      .set({ revoked_at: new Date() })
      .where("id", "=", principal.sessionId)
      .execute();
    this.events.sessionRevoked(principal.sessionId, "signed_out");
  }

  async markConnected(principal: ParticipantPrincipal): Promise<void> {
    const now = new Date();
    const updated = await this.database
      .updateTable("app.participants")
      .set({ disconnected_at: null, last_seen_at: now })
      .where("id", "=", principal.participantId)
      .where("room_id", "=", principal.roomId)
      .where("membership_status", "=", "joined")
      .returning("id")
      .executeTakeFirst();
    if (!updated) return;
    this.events.presenceChanged({
      roomId: principal.roomId,
      participantId: principal.participantId,
      presence: "connected",
      occurredAt: now.toISOString(),
    });
  }

  async markDisconnected(principal: ParticipantPrincipal): Promise<void> {
    const now = new Date();
    const updated = await this.database
      .updateTable("app.participants")
      .set({ disconnected_at: now, last_seen_at: now })
      .where("id", "=", principal.participantId)
      .where("room_id", "=", principal.roomId)
      .where("membership_status", "=", "joined")
      .returning("id")
      .executeTakeFirst();
    if (!updated) return;
    this.events.presenceChanged({
      roomId: principal.roomId,
      participantId: principal.participantId,
      presence: "away",
      occurredAt: now.toISOString(),
    });
  }

  async runMaintenance(): Promise<void> {
    const expired = await this.database
      .updateTable("app.rooms")
      .set({ status: "expired" })
      .where("status", "=", "lobby")
      .where("expires_at", "<=", new Date())
      .returning("id")
      .execute();
    for (const room of expired) {
      const sessions = await this.database
        .selectFrom("app.participant_sessions as sessions")
        .innerJoin("app.participants as participants", "participants.id", "sessions.participant_id")
        .select("sessions.id")
        .where("participants.room_id", "=", room.id)
        .where((eb) =>
          eb.or([
            eb("sessions.revoked_at", "is", null),
            eb("sessions.revoked_at", ">", new Date()),
          ]),
        )
        .execute();
      await this.database
        .updateTable("app.participant_sessions")
        .set({ revoked_at: new Date() })
        .where(
          "participant_id",
          "in",
          this.database.selectFrom("app.participants").select("id").where("room_id", "=", room.id),
        )
        .execute();
      for (const session of sessions) this.events.sessionRevoked(session.id, "room_expired");
      this.events.roomChanged(room.id);
    }
    const cutoff = new Date(Date.now() - this.config.hostDisconnectGraceSeconds * 1000);
    const candidates = await this.database
      .selectFrom("app.rooms as rooms")
      .innerJoin("app.participants as hosts", "hosts.id", "rooms.host_participant_id")
      .select(["rooms.id", "rooms.host_participant_id"])
      .where("rooms.status", "=", "lobby")
      .where("hosts.disconnected_at", "<=", cutoff)
      .execute();
    for (const candidate of candidates) {
      const changed = await inTransaction(this.database, async (trx) => {
        const room = await trx
          .selectFrom("app.rooms")
          .select(["host_participant_id", "status"])
          .where("id", "=", candidate.id)
          .forUpdate()
          .executeTakeFirst();
        if (
          !room ||
          room.status !== "lobby" ||
          room.host_participant_id !== candidate.host_participant_id
        )
          return false;
        const host = await trx
          .selectFrom("app.participants")
          .select("disconnected_at")
          .where("id", "=", room.host_participant_id!)
          .executeTakeFirst();
        if (!host?.disconnected_at || new Date(host.disconnected_at) > cutoff) return false;
        const next = await trx
          .selectFrom("app.participants")
          .select("id")
          .where("room_id", "=", candidate.id)
          .where("membership_status", "=", "joined")
          .where("id", "!=", room.host_participant_id!)
          .orderBy(sql`case when disconnected_at is null then 0 else 1 end`)
          .orderBy("joined_at")
          .orderBy("id")
          .executeTakeFirst();
        if (!next) return false;
        await trx
          .updateTable("app.rooms")
          .set({ host_participant_id: next.id })
          .where("id", "=", candidate.id)
          .execute();
        return true;
      });
      if (changed) this.events.roomChanged(candidate.id);
    }
  }
}
