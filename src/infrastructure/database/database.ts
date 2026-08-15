import { Kysely, PostgresDialect, sql } from "kysely";
import { Pool, type PoolConfig } from "pg";

import type { AppConfig } from "../configuration/config.js";

// Feature table mappings are introduced by their owning phases.
export type DatabaseSchema = Record<string, never>;

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
