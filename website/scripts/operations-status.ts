import { sql } from "kysely";

import { loadConfig } from "../src/infrastructure/configuration/config.js";
import {
  checkDatabaseReadiness,
  closeDatabase,
  createDatabase,
} from "../src/infrastructure/database/database.js";

const config = loadConfig();
const database = createDatabase(config);
try {
  await checkDatabaseReadiness(database.db, config.databaseReadyTimeoutMs);
  const result = await sql<{
    active_rooms: string;
    overdue_games: string;
    due_jobs: string;
    dead_jobs: string;
    overdue_evidence: string;
  }>`
    select
      (select count(*) from app.rooms where status in ('lobby', 'active'))::text as active_rooms,
      (select count(*) from app.games where phase_deadline_at < now() and ended_at is null)::text as overdue_games,
      (select count(*) from app.jobs where status in ('pending', 'failed') and run_at <= now())::text as due_jobs,
      (select count(*) from app.jobs where status = 'dead')::text as dead_jobs,
      (select count(*) from app.task_submissions where deleted_at is null and delete_after < now())::text as overdue_evidence
  `.execute(database.db);
  process.stdout.write(
    `${JSON.stringify({ checkedAt: new Date().toISOString(), ...result.rows[0] })}\n`,
  );
} finally {
  await closeDatabase(database);
}
