import { createHash, randomUUID } from "node:crypto";

import { sql, type Transaction } from "kysely";

import type { AppConfig } from "../../infrastructure/configuration/config.js";
import type { Database, DatabaseSchema } from "../../infrastructure/database/database.js";
import { inTransaction } from "../../infrastructure/database/transaction.js";
import type { ObjectStorage } from "../../infrastructure/object-storage/storage.js";
import { ApplicationError } from "../../shared/errors/application-error.js";
import { determineWinner } from "../games/domain.js";
import type { GameEvents } from "../games/service.js";
import type { ParticipantPrincipal } from "../rooms/types.js";
import type { ConfirmSubmissionInput, FlagSubmissionInput, UploadIntentInput } from "./schemas.js";
import { normalizeEvidenceImage } from "./media.js";
import {
  EVIDENCE_POLICY,
  type ConfirmationDto,
  type SubmissionDto,
  type UploadIntentDto,
} from "./types.js";

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function hash(operation: string, body: unknown): string {
  return createHash("sha256").update(JSON.stringify({ operation, body })).digest("base64url");
}

function storageUnavailable(): ApplicationError {
  return new ApplicationError(503, "STORAGE_UNAVAILABLE", "Evidence storage is unavailable.");
}

export class EvidenceService {
  constructor(
    private readonly database: Database,
    private readonly config: AppConfig,
    private readonly storage: ObjectStorage,
    private readonly gameEvents?: GameEvents,
  ) {}

  async localCapability(
    token: string,
    bytes?: Uint8Array,
    contentType?: string,
  ): Promise<{ bytes?: Uint8Array; contentType?: string }> {
    if (!this.storage.acceptLocalCapability)
      throw new ApplicationError(404, "NOT_FOUND", "The requested resource was not found.");
    try {
      return await this.storage.acceptLocalCapability(token, bytes, contentType);
    } catch (error) {
      if (
        error instanceof Error &&
        ["INVALID_STORAGE_CAPABILITY", "EXPIRED_STORAGE_CAPABILITY"].includes(error.message)
      )
        throw new ApplicationError(
          403,
          "UPLOAD_CAPABILITY_INVALID",
          "This upload link is invalid or expired.",
        );
      if (error instanceof Error && error.message === "STORAGE_OBJECT_MISMATCH")
        throw new ApplicationError(
          422,
          "UPLOAD_MISMATCH",
          "The selected file does not match the upload request.",
        );
      throw error;
    }
  }

  private async replay<T>(
    trx: Transaction<DatabaseSchema>,
    participantId: string,
    key: string,
    operation: string,
    body: unknown,
  ): Promise<T | null> {
    await sql`select pg_advisory_xact_lock(hashtextextended(${`evidence:${participantId}:${key}`}, 0))`.execute(
      trx,
    );
    const row = await trx
      .selectFrom("app.game_idempotency_records")
      .select(["operation", "request_hash", "response_body", "expires_at"])
      .where("participant_id", "=", participantId)
      .where("key", "=", key)
      .executeTakeFirst();
    if (!row) return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await trx
        .deleteFrom("app.game_idempotency_records")
        .where("participant_id", "=", participantId)
        .where("key", "=", key)
        .execute();
      return null;
    }
    if (row.operation !== operation || row.request_hash !== hash(operation, body))
      throw new ApplicationError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "The Idempotency-Key was already used for a different request.",
      );
    return row.response_body as unknown as T;
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
        request_hash: hash(operation, body),
        response_body: response as Record<string, unknown>,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .execute();
  }

  private async signedIntent(row: {
    id: string;
    object_key: string;
    content_type: string;
    byte_size: string | number;
    checksum: string | null;
    expires_at: Date | string;
  }): Promise<UploadIntentDto> {
    try {
      const capability = await this.storage.createUploadCapability({
        objectKey: row.object_key,
        contentType: row.content_type,
        byteSize: Number(row.byte_size),
        checksum: row.checksum,
        expiresAt: new Date(row.expires_at),
      });
      return {
        uploadId: row.id,
        expiresAt: capability.expiresAt.toISOString(),
        method: capability.method,
        url: capability.url,
        headers: capability.headers,
        policy: EVIDENCE_POLICY,
      };
    } catch {
      throw storageUnavailable();
    }
  }

  async createUploadIntent(
    principal: ParticipantPrincipal,
    assignmentId: string,
    input: UploadIntentInput,
    key: string,
  ): Promise<UploadIntentDto> {
    if (input.byteSize > this.config.evidenceMaxBytes)
      throw new ApplicationError(413, "PAYLOAD_TOO_LARGE", "The evidence file is too large.");
    const safe = await inTransaction(this.database, async (trx) => {
      const operation = `evidence.intent:${assignmentId}`;
      const replayed = await this.replay<{ uploadId: string }>(
        trx,
        principal.participantId,
        key,
        operation,
        input,
      );
      if (replayed) {
        const row = await trx
          .selectFrom("app.evidence_upload_intents")
          .selectAll()
          .where("id", "=", replayed.uploadId)
          .executeTakeFirstOrThrow();
        return row;
      }
      const assignment = await trx
        .selectFrom("app.task_assignments as assignment")
        .innerJoin("app.games as game", "game.id", "assignment.game_id")
        .innerJoin("app.game_participants as actor", (join) =>
          join
            .onRef("actor.game_id", "=", "game.id")
            .on("actor.participant_id", "=", principal.participantId),
        )
        .select([
          "assignment.game_id",
          "assignment.status",
          "game.room_id",
          "game.phase",
          "game.state_version",
          "actor.role",
          "actor.life_status",
        ])
        .where("assignment.id", "=", assignmentId)
        .where("assignment.participant_id", "=", principal.participantId)
        .executeTakeFirst();
      if (!assignment || assignment.room_id !== principal.roomId)
        throw new ApplicationError(
          404,
          "ASSIGNMENT_NOT_FOUND",
          "The task assignment was not found.",
        );
      const lockedGame = await trx
        .selectFrom("app.games")
        .selectAll()
        .where("id", "=", assignment.game_id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (Number(lockedGame.state_version) !== input.expectedStateVersion)
        throw new ApplicationError(409, "GAME_STATE_CONFLICT", "The game state has changed.", {
          currentStateVersion: Number(lockedGame.state_version),
        });
      if (lockedGame.phase !== "task")
        throw new ApplicationError(
          409,
          "ACTION_NOT_ALLOWED_IN_PHASE",
          "Evidence can only be submitted during the task phase.",
        );
      const currentAssignment = await trx
        .selectFrom("app.task_assignments")
        .select("status")
        .where("id", "=", assignmentId)
        .executeTakeFirstOrThrow();
      if (currentAssignment.status === "completed")
        throw new ApplicationError(409, "ASSIGNMENT_ALREADY_COMPLETED", "The task is complete.");
      if (assignment.life_status !== "alive" && assignment.role !== "crew")
        throw new ApplicationError(
          403,
          "PLAYER_NOT_ELIGIBLE",
          "This player cannot complete tasks.",
        );
      const current = await trx
        .selectFrom("app.task_submissions")
        .select("id")
        .where("assignment_id", "=", assignmentId)
        .where("processing_status", "in", ["pending", "accepted"])
        .where("review_status", "!=", "invalid")
        .where("deleted_at", "is", null)
        .executeTakeFirst();
      if (current)
        throw new ApplicationError(
          409,
          "ASSIGNMENT_ALREADY_COMPLETED",
          "The assignment already has evidence.",
        );
      await trx
        .updateTable("app.evidence_upload_intents")
        .set({ status: "expired" })
        .where("assignment_id", "=", assignmentId)
        .where("status", "=", "pending")
        .where("expires_at", "<=", new Date())
        .execute();
      const pendingIntent = await trx
        .selectFrom("app.evidence_upload_intents")
        .select("id")
        .where("assignment_id", "=", assignmentId)
        .where("status", "=", "pending")
        .executeTakeFirst();
      if (pendingIntent)
        throw new ApplicationError(
          409,
          "UPLOAD_ALREADY_PENDING",
          "The assignment already has an active upload intent.",
        );
      const used = await trx
        .selectFrom("app.evidence_upload_intents as intent")
        .innerJoin("app.task_assignments as a", "a.id", "intent.assignment_id")
        .select(sql<number>`coalesce(sum(intent.byte_size), 0)::bigint`.as("bytes"))
        .where("a.game_id", "=", assignment.game_id)
        .where("intent.status", "in", ["pending", "confirmed"])
        .executeTakeFirstOrThrow();
      if (Number(used.bytes) + input.byteSize > this.config.evidenceGameMaxBytes)
        throw new ApplicationError(
          413,
          "GAME_UPLOAD_QUOTA_EXCEEDED",
          "The game evidence quota is exhausted.",
        );
      const now = new Date();
      const row = {
        id: randomUUID(),
        assignment_id: assignmentId,
        participant_id: principal.participantId,
        object_key: `games/${assignment.game_id}/participants/${principal.participantId}/${randomUUID()}.upload`,
        content_type: input.contentType,
        byte_size: input.byteSize,
        checksum: input.checksum ?? null,
        status: "pending" as const,
        expires_at: new Date(now.getTime() + this.config.evidenceUploadTtlSeconds * 1000),
        confirmed_at: null,
        created_at: now,
      };
      await trx.insertInto("app.evidence_upload_intents").values(row).execute();
      await trx
        .insertInto("app.jobs")
        .values({
          id: randomUUID(),
          type: "delete_orphan",
          deduplication_key: `orphan:${row.id}`,
          payload: { uploadId: row.id },
          status: "pending",
          run_at: new Date(row.expires_at.getTime() + this.config.evidenceOrphanTtlSeconds * 1000),
          locked_by: null,
          locked_at: null,
          last_error_code: null,
          updated_at: now,
        })
        .execute();
      await this.remember(trx, principal.participantId, key, operation, input, {
        uploadId: row.id,
      });
      return row;
    });
    return this.signedIntent(safe);
  }

  private async winner(trx: Transaction<DatabaseSchema>, gameId: string) {
    const life = await trx
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
      .executeTakeFirstOrThrow();
    const tasks = await trx
      .selectFrom("app.task_assignments")
      .select([
        sql<number>`count(*)::int`.as("totalRealTasks"),
        sql<number>`count(*) filter (where status = 'completed')::int`.as("completedRealTasks"),
      ])
      .where("game_id", "=", gameId)
      .where("counts_toward_progress", "=", true)
      .executeTakeFirstOrThrow();
    return determineWinner({ ...life, ...tasks });
  }

  async confirm(
    principal: ParticipantPrincipal,
    assignmentId: string,
    input: ConfirmSubmissionInput,
    key: string,
  ): Promise<ConfirmationDto> {
    const operation = `evidence.confirm:${assignmentId}`;
    const replayed = await inTransaction(this.database, (trx) =>
      this.replay<ConfirmationDto>(trx, principal.participantId, key, operation, input),
    );
    if (replayed) return replayed;
    const intent = await this.database
      .selectFrom("app.evidence_upload_intents")
      .selectAll()
      .where("id", "=", input.uploadId)
      .where("assignment_id", "=", assignmentId)
      .where("participant_id", "=", principal.participantId)
      .executeTakeFirst();
    if (!intent) throw new ApplicationError(404, "UPLOAD_NOT_FOUND", "The upload was not found.");
    if (new Date(intent.expires_at).getTime() <= Date.now())
      throw new ApplicationError(409, "UPLOAD_NOT_COMPLETE", "The upload intent has expired.");
    let object;
    try {
      object = await this.storage.head(intent.object_key);
    } catch {
      throw storageUnavailable();
    }
    if (!object)
      throw new ApplicationError(409, "UPLOAD_NOT_COMPLETE", "The upload has not completed.");
    if (
      object.byteSize !== Number(intent.byte_size) ||
      object.contentType !== intent.content_type ||
      (intent.checksum && object.checksum !== intent.checksum)
    )
      throw new ApplicationError(
        422,
        "UPLOAD_INVALID",
        "The uploaded object does not match its intent.",
      );

    const result = await inTransaction(this.database, async (trx) => {
      const replayed = await this.replay<ConfirmationDto>(
        trx,
        principal.participantId,
        key,
        operation,
        input,
      );
      if (replayed)
        return { response: replayed, changed: false, roomId: principal.roomId, gameId: "" };
      const assignment = await trx
        .selectFrom("app.task_assignments")
        .selectAll()
        .where("id", "=", assignmentId)
        .where("participant_id", "=", principal.participantId)
        .executeTakeFirst();
      if (!assignment)
        throw new ApplicationError(
          404,
          "ASSIGNMENT_NOT_FOUND",
          "The task assignment was not found.",
        );
      const game = await trx
        .selectFrom("app.games")
        .selectAll()
        .where("id", "=", assignment.game_id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (game.room_id !== principal.roomId)
        throw new ApplicationError(
          404,
          "ASSIGNMENT_NOT_FOUND",
          "The task assignment was not found.",
        );
      if (Number(game.state_version) !== input.expectedStateVersion)
        throw new ApplicationError(409, "GAME_STATE_CONFLICT", "The game state has changed.", {
          currentStateVersion: Number(game.state_version),
        });
      if (game.phase !== "task")
        throw new ApplicationError(
          409,
          "ACTION_NOT_ALLOWED_IN_PHASE",
          "Evidence can only be confirmed during the task phase.",
        );
      const lockedIntent = await trx
        .selectFrom("app.evidence_upload_intents")
        .selectAll()
        .where("id", "=", input.uploadId)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (lockedIntent.status !== "pending")
        throw new ApplicationError(
          409,
          "UPLOAD_ALREADY_CONFIRMED",
          "The upload was already confirmed.",
        );
      if (assignment.status === "completed")
        throw new ApplicationError(409, "ASSIGNMENT_ALREADY_COMPLETED", "The task is complete.");
      const now = new Date();
      const submissionId = randomUUID();
      await trx
        .insertInto("app.task_submissions")
        .values({
          id: submissionId,
          assignment_id: assignmentId,
          uploader_participant_id: principal.participantId,
          object_key: lockedIntent.object_key,
          content_type: lockedIntent.content_type,
          byte_size: lockedIntent.byte_size,
          checksum: lockedIntent.checksum,
          processing_status: "pending",
          review_status: "valid",
          processed_at: null,
          delete_after: null,
          deleted_at: null,
        })
        .execute();
      await trx
        .updateTable("app.evidence_upload_intents")
        .set({ status: "confirmed", confirmed_at: now })
        .where("id", "=", lockedIntent.id)
        .execute();
      await trx
        .updateTable("app.task_assignments")
        .set({ status: "completed", completed_at: now })
        .where("id", "=", assignmentId)
        .execute();
      const nextVersion = Number(game.state_version) + 1;
      const winner = await this.winner(trx, game.id);
      await trx
        .updateTable("app.games")
        .set(
          winner
            ? {
                state_version: nextVersion,
                winner,
                phase: "game_over",
                phase_deadline_at: null,
                ended_at: now,
              }
            : { state_version: nextVersion },
        )
        .where("id", "=", game.id)
        .execute();
      if (winner) {
        await trx
          .updateTable("app.rooms")
          .set({ status: "completed", last_activity_at: now })
          .where("id", "=", game.room_id)
          .execute();
        const deletionAt = new Date(now.getTime() + this.config.evidenceRetentionSeconds * 1000);
        await trx
          .updateTable("app.task_submissions")
          .set({ delete_after: deletionAt })
          .where(
            "assignment_id",
            "in",
            trx.selectFrom("app.task_assignments").select("id").where("game_id", "=", game.id),
          )
          .execute();
        const ids = await trx
          .selectFrom("app.task_submissions as s")
          .innerJoin("app.task_assignments as a", "a.id", "s.assignment_id")
          .select("s.id")
          .where("a.game_id", "=", game.id)
          .where("s.deleted_at", "is", null)
          .execute();
        if (ids.length)
          await trx
            .insertInto("app.jobs")
            .values(
              ids.map((item) => ({
                id: randomUUID(),
                type: "delete_evidence" as const,
                deduplication_key: `delete:${item.id}`,
                payload: { submissionId: item.id },
                status: "pending" as const,
                run_at: deletionAt,
                locked_by: null,
                locked_at: null,
                last_error_code: null,
                updated_at: now,
              })),
            )
            .execute();
      }
      await trx
        .insertInto("app.jobs")
        .values({
          id: randomUUID(),
          type: "process_evidence",
          deduplication_key: `process:${submissionId}`,
          payload: { submissionId },
          status: "pending",
          run_at: now,
          locked_by: null,
          locked_at: null,
          last_error_code: null,
          updated_at: now,
        })
        .execute();
      await trx
        .insertInto("app.game_events")
        .values({
          game_id: game.id,
          state_version: nextVersion,
          type: winner ? "game.completed" : "evidence.confirmed",
          actor_participant_id: principal.participantId,
          visibility: "public",
          payload: winner ? { schemaVersion: 1, winner } : { schemaVersion: 1, submissionId },
        })
        .execute();
      const progress = await trx
        .selectFrom("app.task_assignments")
        .select([
          sql<number>`count(*)::int`.as("total"),
          sql<number>`count(*) filter (where status = 'completed')::int`.as("completed"),
        ])
        .where("game_id", "=", game.id)
        .where("counts_toward_progress", "=", true)
        .executeTakeFirstOrThrow();
      const response: ConfirmationDto = {
        submission: {
          id: submissionId,
          assignmentId,
          processingStatus: "pending",
          reviewStatus: "valid",
          createdAt: now.toISOString(),
        },
        assignmentStatus: "completed",
        progress: {
          percent: progress.total ? Math.round((progress.completed / progress.total) * 100) : 0,
        },
        stateVersion: nextVersion,
      };
      await this.remember(trx, principal.participantId, key, operation, input, response);
      return { response, changed: true, roomId: game.room_id, gameId: game.id };
    });
    if (result.changed)
      this.gameEvents?.gameChanged(result.roomId, result.gameId, result.response.stateVersion);
    return result.response;
  }

  async list(
    principal: ParticipantPrincipal,
    flaggedOnly: boolean,
    limit: number,
    offset: number,
  ): Promise<SubmissionDto[]> {
    const game = await this.database
      .selectFrom("app.games")
      .select("id")
      .where("room_id", "=", principal.roomId)
      .orderBy("started_at", "desc")
      .executeTakeFirst();
    if (!game) throw new ApplicationError(404, "GAME_NOT_FOUND", "No current game was found.");
    const member = await this.database
      .selectFrom("app.game_participants")
      .select("participant_id")
      .where("game_id", "=", game.id)
      .where("participant_id", "=", principal.participantId)
      .executeTakeFirst();
    if (!member)
      throw new ApplicationError(403, "FORBIDDEN", "The submission is not visible to this player.");
    let query = this.database
      .selectFrom("app.task_submissions as s")
      .innerJoin("app.task_assignments as a", "a.id", "s.assignment_id")
      .innerJoin("app.participants as p", "p.id", "s.uploader_participant_id")
      .select([
        "s.id",
        "s.assignment_id",
        "s.uploader_participant_id",
        "s.object_key",
        "s.processing_status",
        "s.review_status",
        "s.created_at",
        "p.nickname",
      ])
      .where("a.game_id", "=", game.id)
      .where("s.processing_status", "=", "accepted")
      .where("s.deleted_at", "is", null);
    if (flaggedOnly) query = query.where("s.review_status", "=", "flagged");
    const rows = await query
      .orderBy("s.created_at")
      .orderBy("s.id")
      .limit(limit)
      .offset(offset)
      .execute();
    const selfFlags = rows.length
      ? await this.database
          .selectFrom("app.submission_flags")
          .select("submission_id")
          .where("flagger_participant_id", "=", principal.participantId)
          .where(
            "submission_id",
            "in",
            rows.map((row) => row.id),
          )
          .execute()
      : [];
    const selfSet = new Set(selfFlags.map((row) => row.submission_id));
    return Promise.all(
      rows.map(async (row) => {
        const expiresAt = new Date(Date.now() + this.config.evidenceViewTtlSeconds * 1000);
        let url: string;
        try {
          url = await this.storage.createReadUrl(row.object_key, expiresAt);
        } catch {
          throw storageUnavailable();
        }
        return {
          id: row.id,
          assignmentId: row.assignment_id,
          uploader: { id: row.uploader_participant_id, nickname: row.nickname },
          processingStatus: row.processing_status,
          reviewStatus: row.review_status,
          createdAt: iso(row.created_at),
          image: { url, expiresAt: expiresAt.toISOString() },
          flaggedBySelf: selfSet.has(row.id),
        };
      }),
    );
  }

  async flag(
    principal: ParticipantPrincipal,
    submissionId: string,
    input: FlagSubmissionInput,
    key: string,
  ) {
    const result = await inTransaction(this.database, async (trx) => {
      const operation = `evidence.flag:${submissionId}`;
      const replayed = await this.replay<{
        submissionId: string;
        reviewStatus: "flagged";
        stateVersion: number;
      }>(trx, principal.participantId, key, operation, input);
      if (replayed)
        return { response: replayed, changed: false, roomId: principal.roomId, gameId: "" };
      const submission = await trx
        .selectFrom("app.task_submissions as s")
        .innerJoin("app.task_assignments as a", "a.id", "s.assignment_id")
        .innerJoin("app.games as g", "g.id", "a.game_id")
        .select([
          "s.uploader_participant_id",
          "s.processing_status",
          "s.review_status",
          "a.game_id",
          "g.room_id",
          "g.state_version",
          "g.phase",
        ])
        .where("s.id", "=", submissionId)
        .executeTakeFirst();
      if (!submission || submission.room_id !== principal.roomId)
        throw new ApplicationError(404, "SUBMISSION_NOT_FOUND", "The submission was not found.");
      const game = await trx
        .selectFrom("app.games")
        .selectAll()
        .where("id", "=", submission.game_id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      if (Number(game.state_version) !== input.expectedStateVersion)
        throw new ApplicationError(409, "GAME_STATE_CONFLICT", "The game state has changed.", {
          currentStateVersion: Number(game.state_version),
        });
      const actor = await trx
        .selectFrom("app.game_participants")
        .select("life_status")
        .where("game_id", "=", game.id)
        .where("participant_id", "=", principal.participantId)
        .executeTakeFirst();
      if (!actor || actor.life_status !== "alive")
        throw new ApplicationError(
          403,
          "PLAYER_NOT_ELIGIBLE",
          "Only living players can flag evidence.",
        );
      if (submission.uploader_participant_id === principal.participantId)
        throw new ApplicationError(
          403,
          "SELF_FLAG_NOT_ALLOWED",
          "Players cannot flag their own evidence.",
        );
      if (game.phase === "game_over" || game.phase === "abandoned")
        throw new ApplicationError(
          409,
          "SUBMISSION_ALREADY_RESOLVED",
          "The submission is not eligible for flagging.",
        );
      if (
        submission.processing_status !== "accepted" ||
        ["invalid"].includes(submission.review_status)
      )
        throw new ApplicationError(
          409,
          "SUBMISSION_ALREADY_RESOLVED",
          "The submission is not eligible for flagging.",
        );
      const existing = await trx
        .selectFrom("app.submission_flags")
        .select("id")
        .where("submission_id", "=", submissionId)
        .where("flagger_participant_id", "=", principal.participantId)
        .executeTakeFirst();
      if (existing)
        throw new ApplicationError(
          409,
          "ALREADY_FLAGGED",
          "This player already flagged the submission.",
        );
      const nextVersion = Number(game.state_version) + 1;
      await trx
        .insertInto("app.submission_flags")
        .values({
          id: randomUUID(),
          submission_id: submissionId,
          flagger_participant_id: principal.participantId,
          reason: input.reason ?? null,
          resolved_at: null,
        })
        .execute();
      await trx
        .updateTable("app.task_submissions")
        .set({ review_status: "flagged" })
        .where("id", "=", submissionId)
        .execute();
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
          type: "evidence.flagged",
          actor_participant_id: principal.participantId,
          visibility: "public",
          payload: { schemaVersion: 1, submissionId },
        })
        .execute();
      const response = {
        submissionId,
        reviewStatus: "flagged" as const,
        stateVersion: nextVersion,
      };
      await this.remember(trx, principal.participantId, key, operation, input, response);
      return { response, changed: true, roomId: game.room_id, gameId: game.id };
    });
    if (result.changed)
      this.gameEvents?.gameChanged(result.roomId, result.gameId, result.response.stateVersion);
    return result.response;
  }

  async unresolvedFlagged(gameId: string): Promise<string[]> {
    const rows = await this.database
      .selectFrom("app.task_submissions as s")
      .innerJoin("app.task_assignments as a", "a.id", "s.assignment_id")
      .innerJoin("app.submission_flags as f", "f.submission_id", "s.id")
      .select("s.id")
      .distinct()
      .where("a.game_id", "=", gameId)
      .where("s.review_status", "=", "flagged")
      .where("f.resolved_at", "is", null)
      .orderBy("s.id")
      .execute();
    return rows.map((row) => row.id);
  }

  async runNextJob(workerId: string): Promise<boolean> {
    const job = await inTransaction(this.database, async (trx) => {
      await trx
        .updateTable("app.jobs")
        .set({
          status: "failed",
          locked_by: null,
          locked_at: null,
          last_error_code: "STALE_LEASE",
          run_at: new Date(),
          updated_at: new Date(),
        })
        .where("status", "=", "running")
        .where("locked_at", "<", new Date(Date.now() - 5 * 60 * 1000))
        .execute();
      const row = await trx
        .selectFrom("app.jobs")
        .selectAll()
        .where("status", "in", ["pending", "failed"])
        .where("run_at", "<=", new Date())
        .orderBy("run_at")
        .forUpdate()
        .skipLocked()
        .executeTakeFirst();
      if (!row) return null;
      await trx
        .updateTable("app.jobs")
        .set({
          status: "running",
          locked_by: workerId,
          locked_at: new Date(),
          updated_at: new Date(),
        })
        .where("id", "=", row.id)
        .execute();
      return row;
    });
    if (!job) return false;
    try {
      if (job.type === "process_evidence")
        await this.processSubmission(String(job.payload.submissionId));
      else if (job.type === "delete_evidence")
        await this.deleteSubmission(String(job.payload.submissionId));
      else await this.deleteOrphan(String(job.payload.uploadId));
      await this.database
        .updateTable("app.jobs")
        .set({
          status: "succeeded",
          locked_by: null,
          locked_at: null,
          last_error_code: null,
          updated_at: new Date(),
        })
        .where("id", "=", job.id)
        .execute();
    } catch {
      const attempts = Number(job.attempt_count) + 1;
      const dead = attempts >= Number(job.max_attempts);
      await this.database
        .updateTable("app.jobs")
        .set({
          status: dead ? "dead" : "failed",
          attempt_count: attempts,
          run_at: new Date(Date.now() + Math.min(300, 2 ** attempts) * 1000),
          locked_by: null,
          locked_at: null,
          last_error_code: `${job.type.toUpperCase()}_FAILED`,
          updated_at: new Date(),
        })
        .where("id", "=", job.id)
        .execute();
    }
    return true;
  }

  private async processSubmission(submissionId: string): Promise<void> {
    const row = await this.database
      .selectFrom("app.task_submissions")
      .selectAll()
      .where("id", "=", submissionId)
      .executeTakeFirst();
    if (!row || row.processing_status !== "pending") return;
    const stored = await this.storage.head(row.object_key);
    if (!stored) {
      await this.rejectAndReopen(row.id);
      return;
    }
    const source = await this.storage.read(row.object_key);
    if (row.checksum && createHash("sha256").update(source).digest("base64") !== row.checksum) {
      await this.storage.delete(row.object_key);
      if (await this.storage.head(row.object_key)) throw new Error("STORAGE_DELETE_UNVERIFIED");
      await this.rejectAndReopen(row.id);
      return;
    }
    let normalized;
    try {
      normalized = await normalizeEvidenceImage({
        bytes: source,
        declaredContentType: row.content_type,
        maximumBytes: this.config.evidenceMaxBytes,
        maximumPixels: this.config.evidenceMaxPixels,
      });
    } catch {
      try {
        await this.storage.delete(row.object_key);
        if (await this.storage.head(row.object_key)) throw new Error("STORAGE_DELETE_UNVERIFIED");
      } catch {
        /* retried by the job */ throw new Error("STORAGE_DELETE_FAILED");
      }
      await this.rejectAndReopen(row.id);
      return;
    }
    const normalizedKey = `${row.object_key.slice(0, row.object_key.lastIndexOf("/") + 1)}${randomUUID()}.webp`;
    await this.storage.replace(normalizedKey, normalized.bytes, normalized.contentType);
    try {
      await this.database
        .updateTable("app.task_submissions")
        .set({
          object_key: normalizedKey,
          processing_status: "accepted",
          content_type: normalized.contentType,
          byte_size: normalized.bytes.byteLength,
          checksum: null,
          processed_at: new Date(),
        })
        .where("id", "=", row.id)
        .where("processing_status", "=", "pending")
        .execute();
    } catch (error) {
      try {
        await this.storage.delete(normalizedKey);
      } catch {
        // The normalized object remains private and the original orphan job remains observable.
      }
      throw error;
    }
    try {
      await this.storage.delete(row.object_key);
    } catch {
      // The upload-intent orphan job retries cleanup after the signing window closes.
    }
  }

  private async rejectAndReopen(submissionId: string): Promise<void> {
    const changed = await inTransaction(this.database, async (trx) => {
      const row = await trx
        .selectFrom("app.task_submissions as s")
        .innerJoin("app.task_assignments as a", "a.id", "s.assignment_id")
        .select(["s.processing_status", "s.assignment_id", "a.game_id"])
        .where("s.id", "=", submissionId)
        .forUpdate()
        .executeTakeFirst();
      if (!row || row.processing_status !== "pending") return null;
      const game = await trx
        .selectFrom("app.games")
        .selectAll()
        .where("id", "=", row.game_id)
        .forUpdate()
        .executeTakeFirstOrThrow();
      const room = await trx
        .selectFrom("app.rooms")
        .select("task_phase_seconds")
        .where("id", "=", game.room_id)
        .executeTakeFirstOrThrow();
      const now = new Date();
      const nextVersion = Number(game.state_version) + 1;
      await trx
        .updateTable("app.task_submissions")
        .set({
          processing_status: "rejected",
          review_status: "invalid",
          processed_at: now,
          deleted_at: now,
        })
        .where("id", "=", submissionId)
        .execute();
      await trx
        .updateTable("app.task_assignments")
        .set({ status: "assigned", completed_at: null })
        .where("id", "=", row.assignment_id)
        .execute();
      const reopen = game.phase === "game_over" && game.winner === "crew";
      await trx
        .updateTable("app.games")
        .set(
          reopen
            ? {
                state_version: nextVersion,
                phase: "task",
                winner: null,
                ended_at: null,
                phase_started_at: now,
                phase_deadline_at: new Date(now.getTime() + room.task_phase_seconds * 1000),
              }
            : { state_version: nextVersion },
        )
        .where("id", "=", game.id)
        .execute();
      if (reopen)
        await trx
          .updateTable("app.rooms")
          .set({ status: "active", last_activity_at: now })
          .where("id", "=", game.room_id)
          .execute();
      await trx
        .insertInto("app.game_events")
        .values({
          game_id: game.id,
          state_version: nextVersion,
          type: "evidence.rejected",
          actor_participant_id: null,
          visibility: "actor",
          payload: { schemaVersion: 1, submissionId },
        })
        .execute();
      return { roomId: game.room_id, gameId: game.id, stateVersion: nextVersion };
    });
    if (changed) this.gameEvents?.gameChanged(changed.roomId, changed.gameId, changed.stateVersion);
  }

  private async deleteSubmission(submissionId: string): Promise<void> {
    const row = await this.database
      .selectFrom("app.task_submissions")
      .select(["object_key", "deleted_at"])
      .where("id", "=", submissionId)
      .executeTakeFirst();
    if (!row || row.deleted_at) return;
    await this.storage.delete(row.object_key);
    if (await this.storage.head(row.object_key)) throw new Error("STORAGE_DELETE_UNVERIFIED");
    await this.database
      .updateTable("app.task_submissions")
      .set({ processing_status: "deleted", deleted_at: new Date() })
      .where("id", "=", submissionId)
      .execute();
  }

  private async deleteOrphan(uploadId: string): Promise<void> {
    const row = await this.database
      .selectFrom("app.evidence_upload_intents")
      .selectAll()
      .where("id", "=", uploadId)
      .executeTakeFirst();
    if (!row) return;
    if (row.status === "confirmed") {
      const stillCurrent = await this.database
        .selectFrom("app.task_submissions")
        .select("id")
        .where("object_key", "=", row.object_key)
        .where("deleted_at", "is", null)
        .executeTakeFirst();
      if (stillCurrent) return;
    }
    await this.storage.delete(row.object_key);
    if (await this.storage.head(row.object_key)) throw new Error("STORAGE_DELETE_UNVERIFIED");
    await this.database
      .updateTable("app.evidence_upload_intents")
      .set({ status: "expired" })
      .where("id", "=", row.id)
      .execute();
  }

  async scheduleTerminalRetention(): Promise<number> {
    return inTransaction(this.database, async (trx) => {
      const rows = await trx
        .selectFrom("app.task_submissions as submission")
        .innerJoin(
          "app.task_assignments as assignment",
          "assignment.id",
          "submission.assignment_id",
        )
        .innerJoin("app.games as game", "game.id", "assignment.game_id")
        .innerJoin("app.rooms as room", "room.id", "game.room_id")
        .select(["submission.id", "game.ended_at", "room.expires_at"])
        .where("submission.deleted_at", "is", null)
        .where("submission.delete_after", "is", null)
        .where("room.status", "in", ["completed", "abandoned", "expired"])
        .forUpdate()
        .skipLocked()
        .execute();
      const now = new Date();
      for (const row of rows) {
        const terminalAt = row.ended_at ? new Date(row.ended_at) : new Date(row.expires_at);
        const deleteAfter = new Date(
          terminalAt.getTime() + this.config.evidenceRetentionSeconds * 1000,
        );
        await trx
          .updateTable("app.task_submissions")
          .set({ delete_after: deleteAfter })
          .where("id", "=", row.id)
          .execute();
        await trx
          .insertInto("app.jobs")
          .values({
            id: randomUUID(),
            type: "delete_evidence",
            deduplication_key: `delete:${row.id}`,
            payload: { submissionId: row.id },
            status: "pending",
            run_at: deleteAfter,
            locked_by: null,
            locked_at: null,
            last_error_code: null,
            updated_at: now,
          })
          .execute();
      }
      return rows.length;
    });
  }
}
