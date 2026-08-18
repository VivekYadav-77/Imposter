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

export interface DatabaseSchema {
  "app.admin_users": AdminUsersTable;
  "app.admin_sessions": AdminSessionsTable;
  "app.task_packs": TaskPacksTable;
  "app.task_pack_items": TaskPackItemsTable;
  "app.admin_audit_events": AdminAuditEventsTable;
  "app.admin_idempotency_records": AdminIdempotencyRecordsTable;
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
