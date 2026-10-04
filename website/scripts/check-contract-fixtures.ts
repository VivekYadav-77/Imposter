import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const schema = JSON.parse(await readFile(resolve("contracts/realtime-v1.schema.json"), "utf8")) as {
  title?: string;
};
const fixtures = JSON.parse(
  await readFile(resolve("contracts/fixtures/realtime-v1.json"), "utf8"),
) as Array<Record<string, unknown>>;

if (schema.title !== "Imposter Game realtime schema v1")
  throw new Error("Realtime v1 schema is missing or has changed identity.");
const supported = new Set([
  "room.snapshot",
  "game.snapshot",
  "presence.changed",
  "session.revoked",
  "server.resync_required",
  "server.ready",
]);
for (const [index, fixture] of fixtures.entries()) {
  if (fixture.schemaVersion !== 1) throw new Error(`Fixture ${index} is not schemaVersion 1.`);
  if (typeof fixture.type !== "string" || !supported.has(fixture.type))
    throw new Error(`Fixture ${index} has an unsupported event type.`);
  if (typeof fixture.occurredAt !== "string" || Number.isNaN(Date.parse(fixture.occurredAt)))
    throw new Error(`Fixture ${index} has an invalid occurredAt value.`);
}
process.stdout.write(`Realtime v1 schema and ${fixtures.length} fixtures are current.\n`);
