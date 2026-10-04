import { randomUUID } from "node:crypto";

import { Pool } from "pg";

import { hashPassword } from "../src/shared/security/password.js";

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const databaseUrl = process.env.DATABASE_URL;
const email = (argument("--email") ?? process.env.ADMIN_BOOTSTRAP_EMAIL)?.trim().toLowerCase();
const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

if (!databaseUrl) throw new Error("DATABASE_URL is required.");
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
  throw new Error("A valid --email or ADMIN_BOOTSTRAP_EMAIL is required.");
if (!password || password.length < 12 || password.length > 128)
  throw new Error("ADMIN_BOOTSTRAP_PASSWORD must contain 12 to 128 characters.");

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
try {
  await pool.query("begin");
  // Serialize bootstrap attempts across processes. The count-then-insert must
  // be atomic or two operators starting the command concurrently could both
  // provision an initial administrator.
  await pool.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [
    "imposter-game:admin-bootstrap",
  ]);
  const existing = await pool.query<{ count: string }>(
    "select count(*)::text as count from app.admin_users",
  );
  if (Number(existing.rows[0]?.count ?? 0) > 0)
    throw new Error(
      "Bootstrap refused: an administrator already exists. Use an approved manual recovery procedure.",
    );
  const passwordHash = await hashPassword(password);
  await pool.query(
    "insert into app.admin_users (id, email, password_hash, status) values ($1, $2, $3, 'active')",
    [randomUUID(), email, passwordHash],
  );
  await pool.query("commit");
  process.stdout.write(
    `Provisioned administrator ${email}. Remove ADMIN_BOOTSTRAP_PASSWORD from the environment now.\n`,
  );
} catch (error) {
  await pool.query("rollback").catch(() => undefined);
  throw error;
} finally {
  await pool.end();
}
