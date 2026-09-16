import { randomUUID } from "node:crypto";
import { loadEnvFile } from "node:process";

import { Pool, type PoolClient } from "pg";

import { hashPassword } from "../src/shared/security/password.js";

try {
  loadEnvFile(".env");
} catch {
  // CI or operators may provide the environment directly without a local file.
}

const databaseUrl = process.env.DATABASE_URL;
const appEnvironment = process.env.APP_ENV ?? "development";
const demoEmail = (process.env.DEMO_ADMIN_EMAIL ?? "admin@imposter.local").trim().toLowerCase();
const demoPassword = process.env.DEMO_ADMIN_PASSWORD ?? "DemoAdmin123!";

if (!databaseUrl) throw new Error("DATABASE_URL is required.");
if (appEnvironment !== "development" && process.env.ALLOW_DEMO_SEED !== "true")
  throw new Error("Demo data can only be seeded in development (or with ALLOW_DEMO_SEED=true).");
if (demoPassword.length < 12 || demoPassword.length > 128)
  throw new Error("DEMO_ADMIN_PASSWORD must contain 12 to 128 characters.");

const maps = [
  {
    slug: "downtown-dash",
    name: "Downtown Dash",
    description:
      "Fast outdoor missions around a walkable city centre. Ideal for a first full test.",
    status: "published",
    tasks: [
      "Photograph your team beside a street map",
      "Find a building with a clock and take a photo",
      "Recreate a statue pose",
      "Photograph three different road signs",
      "Find a shop name containing your first initial",
      "Take a photo of a red vehicle",
      "Find the oldest-looking doorway nearby",
      "Make a human arrow pointing north",
      "Photograph a reflection without showing the camera",
      "Find a public bench and stage a dramatic meeting",
      "Capture a team photo at a pedestrian crossing",
      "Find an unusual window and photograph it",
    ],
  },
  {
    slug: "office-outbreak",
    name: "Office Outbreak",
    description: "Indoor workplace tasks for testing short-range games and photo evidence.",
    status: "published",
    tasks: [
      "Build the tallest safe tower from stationery",
      "Photograph a mug that is not yours",
      "Make a paper aeroplane and show where it lands",
      "Find three objects matching your team colour",
      "Recreate a famous movie poster using office items",
      "Take a photo beside the nearest fire exit sign",
      "Arrange five pens from shortest to longest",
      "Find an object older than five years",
      "Write your room code using sticky notes",
      "Photograph a plant from directly above",
    ],
  },
  {
    slug: "campus-chaos",
    name: "Campus Chaos",
    description: "A broad campus map with a few inactive tasks for admin filtering tests.",
    status: "published",
    tasks: [
      "Find a room number containing the digit seven",
      "Photograph a noticeboard with at least five notices",
      "Take a team photo on a staircase",
      "Find a book with a one-word title",
      "Photograph the view from the highest public floor",
      "Find a recycling symbol",
      "Pose like a lecturer at a whiteboard",
      "Photograph something representing each primary colour",
      "Find a quiet-zone sign",
      "Create a symmetrical photo with your teammates",
      "Find a date printed before the year 2000",
      "Photograph an emergency assembly point",
    ],
    inactive: [10, 11],
  },
  {
    slug: "rainy-day-lab",
    name: "Rainy Day Lab",
    description: "Draft map intentionally left ready for editing and CSV replacement tests.",
    status: "draft",
    tasks: [
      "Photograph water droplets on a window",
      "Find the brightest umbrella",
      "Make a tiny paper boat",
      "Capture a reflection in a puddle",
      "Find a weather-related word indoors",
      "Create a rainbow from available objects",
    ],
  },
  {
    slug: "weekend-market",
    name: "Weekend Market",
    description: "Incomplete draft included to test validation and publish-error states.",
    status: "draft",
    tasks: [
      "Find a handwritten price sign",
      "Photograph three kinds of fruit",
      "Find a reusable bag",
    ],
  },
  {
    slug: "old-training-map",
    name: "Old Training Map",
    description: "Archived sample for testing read-only editor controls and status filters.",
    status: "archived",
    tasks: Array.from({ length: 10 }, (_, index) => `Archived practice task ${index + 1}`),
  },
] as const;

async function seedMap(client: PoolClient, adminId: string, map: (typeof maps)[number]) {
  const existing = await client.query<{ id: string }>(
    "select id from app.task_packs where slug = $1",
    [map.slug],
  );
  const id = existing.rows[0]?.id ?? randomUUID();
  const publishedAt = map.status === "published" ? new Date() : null;
  await client.query(
    `insert into app.task_packs
      (id, created_by_admin_id, slug, name, description, status, revision, published_at)
     values ($1, $2, $3, $4, $5, $6, 1, $7)
     on conflict (slug) do update set
       created_by_admin_id = excluded.created_by_admin_id,
       name = excluded.name,
       description = excluded.description,
       status = excluded.status,
       revision = 1,
       published_at = excluded.published_at,
       updated_at = current_timestamp`,
    [id, adminId, map.slug, map.name, map.description, map.status, publishedAt],
  );
  await client.query("delete from app.task_pack_items where task_pack_id = $1", [id]);
  for (const [index, description] of map.tasks.entries()) {
    const inactive = "inactive" in map ? map.inactive.includes(index as never) : false;
    await client.query(
      `insert into app.task_pack_items
        (id, task_pack_id, position, description, is_active)
       values ($1, $2, $3, $4, $5)`,
      [randomUUID(), id, index + 1, description, !inactive],
    );
  }
}

const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
try {
  await client.query("begin");
  const existingAdmin = await client.query<{ id: string }>(
    "select id from app.admin_users where email = $1",
    [demoEmail],
  );
  const adminId = existingAdmin.rows[0]?.id ?? randomUUID();
  const passwordHash = await hashPassword(demoPassword);
  await client.query(
    `insert into app.admin_users (id, email, password_hash, status)
     values ($1, $2, $3, 'active')
     on conflict (email) do update set
       password_hash = excluded.password_hash,
       status = 'active',
       updated_at = current_timestamp`,
    [adminId, demoEmail, passwordHash],
  );
  for (const map of maps) await seedMap(client, adminId, map);
  await client.query("commit");
  process.stdout.write(
    `Demo data ready: ${maps.length} maps. Sign in with ${demoEmail} / ${demoPassword}\n`,
  );
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
