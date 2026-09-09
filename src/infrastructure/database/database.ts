import { Kysely, PostgresDialect, sql, type ColumnType, type Generated } from "kysely";
import { Pool, type PoolConfig } from "pg";

import type { AppConfig } from "../configuration/config.js";

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type NullableTimestamp = ColumnType<
  Date | null,
  Date | string | null | undefined,
  Date | string | null
>;

export interface AdminUsersTable {
  id: string;
  email: string;
  password_hash: string;
  status: "active" | "disabled";
  last_login_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AdminSessionsTable {
  id: string;
  admin_user_id: string;
  token_hash: string;
  issued_at: Timestamp;
  expires_at: Timestamp;
  last_used_at: NullableTimestamp;
  revoked_at: NullableTimestamp;
  created_ip_hash: string | null;
}

export interface TaskPacksTable {
  id: string;
  created_by_admin_id: string;
  slug: string;
  name: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  revision: Generated<number>;
  published_at: NullableTimestamp;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface TaskPackItemsTable {
  id: string;
  task_pack_id: string;
  position: number;
  description: string;
  is_active: Generated<boolean>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface AdminAuditEventsTable {
  id: string;
  admin_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  request_id: string | null;
  ip_hash: string | null;
  outcome: "success" | "failure";
  metadata: Generated<Record<string, unknown>>;
  created_at: Timestamp;
}

export interface AdminIdempotencyRecordsTable {
  admin_user_id: string;
  key: string;
  operation: string;
  request_hash: string;
  response_body: Record<string, unknown>;
  created_at: Timestamp;
  expires_at: Timestamp;
}

export interface RoomsTable {
  id: string;
  code: string;
  status: "lobby" | "active" | "completed" | "abandoned" | "expired";
  host_participant_id: string | null;
  selected_task_pack_id: string | null;
  max_players: number;
  imposter_count: number;
  tasks_per_crew: number;
  task_phase_seconds: number;
  discussion_seconds: number;
  review_seconds: number;
  voting_seconds: number;
  created_at: Timestamp;
  last_activity_at: Timestamp;
  expires_at: Timestamp;
}

export interface ParticipantsTable {
  id: string;
  room_id: string;
  nickname: string;
  normalized_nickname: string;
  membership_status: "joined" | "left" | "removed";
  joined_at: Timestamp;
  last_seen_at: Timestamp;
  disconnected_at: NullableTimestamp;
}

export interface ParticipantSessionsTable {
  id: string;
  participant_id: string;
  token_hash: string;
  issued_at: Timestamp;
  expires_at: Timestamp;
  last_used_at: NullableTimestamp;
  revoked_at: NullableTimestamp;
}

export interface RoomIdempotencyRecordsTable {
  scope: string;
  key: string;
  operation: string;
  request_hash: string;
  response_body: Record<string, unknown>;
  session_id: string | null;
  created_at: Timestamp;
  expires_at: Timestamp;
}

export interface GamesTable {
  id: string;
  room_id: string;
  source_task_pack_id: string;
  task_pack_name_snapshot: string;
  phase: "task" | "discussion" | "review" | "voting" | "result" | "game_over" | "abandoned";
  state_version: ColumnType<string, string | number | undefined, string | number>;
  winner: "crew" | "imposters" | null;
  phase_started_at: Timestamp;
  phase_deadline_at: NullableTimestamp;
  started_at: Timestamp;
  ended_at: NullableTimestamp;
}

export interface GameParticipantsTable {
  game_id: string;
  participant_id: string;
  role: "crew" | "imposter";
  life_status: "alive" | "killed" | "ejected";
  kill_available_at: NullableTimestamp;
  created_at: Timestamp;
}

export interface GameTasksTable {
  id: string;
  game_id: string;
  source_pack_item_id: string | null;
  description_snapshot: string;
  position: number;
}

export interface TaskAssignmentsTable {
  id: string;
  game_id: string;
  game_task_id: string;
  participant_id: string;
  counts_toward_progress: boolean;
  status: "assigned" | "completed";
  completed_at: NullableTimestamp;
}

export interface GameEventsTable {
  id: Generated<string>;
  game_id: string;
  state_version: ColumnType<string, string | number, string | number>;
  type: string;
  actor_participant_id: string | null;
  visibility: "internal" | "public" | "actor";
  payload: Generated<Record<string, unknown>>;
  created_at: Timestamp;
}

export interface GameIdempotencyRecordsTable {
  participant_id: string;
  key: string;
  operation: string;
  request_hash: string;
  response_body: Record<string, unknown>;
  created_at: Timestamp;
  expires_at: Timestamp;
}

export interface EvidenceUploadIntentsTable {
  id: string;
  assignment_id: string;
  participant_id: string;
  object_key: string;
  content_type: "image/jpeg" | "image/png" | "image/webp";
  byte_size: ColumnType<string, string | number, string | number>;
  checksum: string | null;
  status: "pending" | "confirmed" | "expired";
  expires_at: Timestamp;
  confirmed_at: NullableTimestamp;
  created_at: Timestamp;
}

export interface TaskSubmissionsTable {
  id: string;
  assignment_id: string;
  uploader_participant_id: string;
  object_key: string;
  content_type: "image/jpeg" | "image/png" | "image/webp";
  byte_size: ColumnType<string, string | number, string | number>;
  checksum: string | null;
  processing_status: "pending" | "accepted" | "rejected" | "deleted";
  review_status: "valid" | "flagged" | "invalid";
  created_at: Timestamp;
  processed_at: NullableTimestamp;
  delete_after: NullableTimestamp;
  deleted_at: NullableTimestamp;
}

export interface SubmissionFlagsTable {
  id: string;
  submission_id: string;
  flagger_participant_id: string;
  reason: string | null;
  created_at: Timestamp;
  resolved_at: NullableTimestamp;
}

export interface MeetingsTable {
  id: string;
  game_id: string;
  sequence_number: number;
  trigger_type: "kill" | "task_deadline";
  trigger_actor_participant_id: string | null;
  reported_participant_id: string | null;
  phase: "discussion" | "review" | "voting" | "resolved";
  deadline_at: NullableTimestamp;
  ejected_participant_id: string | null;
  created_at: Timestamp;
  resolved_at: NullableTimestamp;
}

export interface MeetingEligibleVotersTable {
  meeting_id: string;
  participant_id: string;
}

export interface EvidenceReviewItemsTable {
  id: string;
  meeting_id: string;
  submission_id: string;
  position: number;
  resolution: "valid" | "invalid" | null;
  resolved_at: NullableTimestamp;
}

export interface EvidenceReviewVotesTable {
  id: string;
  review_item_id: string;
  voter_participant_id: string;
  decision: "valid" | "invalid";
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface EjectionVotesTable {
  id: string;
  meeting_id: string;
  voter_participant_id: string;
  target_participant_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface EliminationsTable {
  id: string;
  game_id: string;
  meeting_id: string | null;
  target_participant_id: string;
  actor_participant_id: string | null;
  type: "killed" | "ejected";
  occurred_at: Timestamp;
}

export interface JobsTable {
  id: string;
  type: "process_evidence" | "delete_evidence" | "delete_orphan";
  deduplication_key: string | null;
  payload: Record<string, unknown>;
  status: "pending" | "running" | "succeeded" | "failed" | "dead";
  run_at: Timestamp;
  attempt_count: Generated<number>;
  max_attempts: Generated<number>;
  locked_by: string | null;
  locked_at: NullableTimestamp;
  last_error_code: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface DatabaseSchema {
  "app.admin_users": AdminUsersTable;
  "app.admin_sessions": AdminSessionsTable;
  "app.task_packs": TaskPacksTable;
  "app.task_pack_items": TaskPackItemsTable;
  "app.admin_audit_events": AdminAuditEventsTable;
  "app.admin_idempotency_records": AdminIdempotencyRecordsTable;
  "app.rooms": RoomsTable;
  "app.participants": ParticipantsTable;
  "app.participant_sessions": ParticipantSessionsTable;
  "app.room_idempotency_records": RoomIdempotencyRecordsTable;
  "app.games": GamesTable;
  "app.game_participants": GameParticipantsTable;
  "app.game_tasks": GameTasksTable;
  "app.task_assignments": TaskAssignmentsTable;
  "app.game_events": GameEventsTable;
  "app.game_idempotency_records": GameIdempotencyRecordsTable;
  "app.evidence_upload_intents": EvidenceUploadIntentsTable;
  "app.task_submissions": TaskSubmissionsTable;
  "app.submission_flags": SubmissionFlagsTable;
  "app.meetings": MeetingsTable;
  "app.meeting_eligible_voters": MeetingEligibleVotersTable;
  "app.evidence_review_items": EvidenceReviewItemsTable;
  "app.evidence_review_votes": EvidenceReviewVotesTable;
  "app.ejection_votes": EjectionVotesTable;
  "app.eliminations": EliminationsTable;
  "app.jobs": JobsTable;
}

export type Database = Kysely<DatabaseSchema>;

export interface DatabaseDependencies {
  db: Database;
  pool: Pool;
}

export function createDatabase(config: AppConfig): DatabaseDependencies {
  const poolConfig: PoolConfig = {
    connectionString: config.databaseUrl,
    max: config.databasePoolMax,
    connectionTimeoutMillis: config.databaseConnectionTimeoutMs,
    idleTimeoutMillis: config.databaseIdleTimeoutMs,
    statement_timeout: config.databaseStatementTimeoutMs,
    ssl: config.databaseSsl ? { rejectUnauthorized: true } : undefined,
    application_name: "imposter-game",
  };
  const pool = new Pool(poolConfig);
  const db = new Kysely<DatabaseSchema>({ dialect: new PostgresDialect({ pool }) });
  return { db, pool };
}

export async function checkDatabaseReadiness(db: Database, timeoutMs: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      sql`select 1`.execute(db),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Database readiness timed out")), timeoutMs);
        timer.unref();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function closeDatabase(dependencies: DatabaseDependencies): Promise<void> {
  await dependencies.db.destroy();
}
