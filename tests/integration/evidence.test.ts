import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";

import { loadConfig } from "../../src/infrastructure/configuration/config.js";
import {
  closeDatabase,
  createDatabase,
  type DatabaseDependencies,
} from "../../src/infrastructure/database/database.js";
import type {
  ObjectStorage,
  StoredObjectMetadata,
  UploadCapability,
} from "../../src/infrastructure/object-storage/storage.js";
import { EvidenceService } from "../../src/modules/evidence/service.js";
import { GameService } from "../../src/modules/games/service.js";
import { RoomService } from "../../src/modules/rooms/service.js";

class MemoryStorage implements ObjectStorage {
  readonly objects = new Map<
    string,
    { bytes: Uint8Array; contentType: string; checksum: string | null }
  >();
  lastKey: string | null = null;
  createUploadCapability(input: {
    objectKey: string;
    contentType: string;
    byteSize: number;
    checksum: string | null;
    expiresAt: Date;
  }): Promise<UploadCapability> {
    this.lastKey = input.objectKey;
    return Promise.resolve({
      method: "PUT",
      url: `https://storage.invalid/${randomUUID()}`,
      headers: { "content-type": input.contentType, "content-length": String(input.byteSize) },
      expiresAt: input.expiresAt,
    });
  }
  head(key: string): Promise<StoredObjectMetadata | null> {
    const value = this.objects.get(key);
    return Promise.resolve(
      value
        ? {
            byteSize: value.bytes.byteLength,
            contentType: value.contentType,
            checksum: value.checksum,
          }
        : null,
    );
  }
  read(key: string): Promise<Uint8Array> {
    return Promise.resolve(this.objects.get(key)!.bytes);
  }
  replace(key: string, bytes: Uint8Array, contentType: string): Promise<void> {
    this.objects.set(key, { bytes, contentType, checksum: null });
    return Promise.resolve();
  }
  createReadUrl(): Promise<string> {
    return Promise.resolve(`https://storage.invalid/read/${randomUUID()}`);
  }
  delete(key: string): Promise<void> {
    this.objects.delete(key);
    return Promise.resolve();
  }
  seed(bytes: Uint8Array, contentType: string) {
    this.objects.set(this.lastKey!, { bytes, contentType, checksum: null });
  }
}

const connectionString = process.env.TEST_DATABASE_URL;
const describeWithDatabase = connectionString ? describe : describe.skip;

describeWithDatabase("private evidence lifecycle", () => {
  let dependencies: DatabaseDependencies;
  let rooms: RoomService;
  let games: GameService;
  let evidence: EvidenceService;
  let storage: MemoryStorage;
  const roomIds: string[] = [];
  const adminId = randomUUID();
  const packId = randomUUID();

  beforeAll(async () => {
    const config = loadConfig({
      APP_ENV: "test",
      DATABASE_URL: connectionString!,
      PARTICIPANT_SESSION_TOKEN_PEPPER: "integration-participant-pepper-32-characters",
    });
    dependencies = createDatabase(config);
    rooms = new RoomService(dependencies.db, config);
    games = new GameService(dependencies.db);
    storage = new MemoryStorage();
    evidence = new EvidenceService(dependencies.db, config, storage, games.events);
    await dependencies.db
      .insertInto("app.admin_users")
      .values({
        id: adminId,
        email: `${adminId}@evidence.test`,
        password_hash: "test",
        status: "active",
        last_login_at: null,
      })
      .execute();
    await dependencies.db
      .insertInto("app.task_packs")
      .values({
        id: packId,
        created_by_admin_id: adminId,
        slug: `evidence-${packId}`,
        name: "Evidence",
        description: null,
        status: "published",
        published_at: new Date(),
      })
      .execute();
    await dependencies.db
      .insertInto("app.task_pack_items")
      .values(
        Array.from({ length: 5 }, (_, index) => ({
          id: randomUUID(),
          task_pack_id: packId,
          position: index + 1,
          description: `Evidence task ${index + 1}`,
          is_active: true,
        })),
      )
      .execute();
  });

  afterAll(async () => {
    if (roomIds.length)
      await dependencies.db.deleteFrom("app.rooms").where("id", "in", roomIds).execute();
    await dependencies.db.deleteFrom("app.task_packs").where("id", "=", packId).execute();
    await dependencies.db.deleteFrom("app.admin_users").where("id", "=", adminId).execute();
    await closeDatabase(dependencies);
  });

  async function startedRoom() {
    const issued = [
      await rooms.createRoom({ nickname: "Host" }, randomUUID(), `ev:${randomUUID()}`),
    ];
    roomIds.push(issued[0].room.id);
    for (let i = 1; i < 4; i += 1)
      issued.push(
        await rooms.joinRoom(
          issued[0].room.code,
          { nickname: `P${i}` },
          randomUUID(),
          `ev:${randomUUID()}`,
        ),
      );
    const principals = await Promise.all(
      issued.map(async (entry) => (await rooms.authenticate(entry.sessionToken))!),
    );
    await rooms.updateSettings(principals[0], { selectedTaskPackId: packId }, randomUUID());
    return { principals, snapshot: await games.start(principals[0], randomUUID()) };
  }

  it("authorizes, normalizes, views, and flags one submission per player", async () => {
    const { principals, snapshot } = await startedRoom();
    const owner = principals.find((p) => p.participantId === snapshot.self.participantId)!;
    const assignmentId = snapshot.assignments[0].id;
    const jpeg = await sharp({ create: { width: 8, height: 8, channels: 3, background: "red" } })
      .jpeg()
      .toBuffer();
    const intent = await evidence.createUploadIntent(
      owner,
      assignmentId,
      {
        expectedStateVersion: snapshot.stateVersion,
        contentType: "image/jpeg",
        byteSize: jpeg.byteLength,
      },
      randomUUID(),
    );
    expect(intent.policy).toMatchObject({ minimumAge: 18, retentionHours: 24 });
    storage.seed(jpeg, "image/jpeg");
    const confirmed = await evidence.confirm(
      owner,
      assignmentId,
      { expectedStateVersion: snapshot.stateVersion, uploadId: intent.uploadId },
      randomUUID(),
    );
    expect(confirmed.submission.processingStatus).toBe("pending");
    expect(await evidence.runNextJob("test-worker")).toBe(true);
    const viewer = principals.find((p) => p.participantId !== owner.participantId)!;
    const listed = await evidence.list(viewer, false, 10, 0);
    expect(listed).toHaveLength(1);
    await expect(
      evidence.flag(
        owner,
        listed[0].id,
        { expectedStateVersion: confirmed.stateVersion },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "SELF_FLAG_NOT_ALLOWED" });
    const flagged = await evidence.flag(
      viewer,
      listed[0].id,
      { expectedStateVersion: confirmed.stateVersion, reason: "unclear" },
      randomUUID(),
    );
    expect(flagged.reviewStatus).toBe("flagged");
    await expect(
      evidence.flag(
        viewer,
        listed[0].id,
        { expectedStateVersion: flagged.stateVersion },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "ALREADY_FLAGGED" });
    await expect(
      evidence.createUploadIntent(
        viewer,
        assignmentId,
        {
          expectedStateVersion: flagged.stateVersion,
          contentType: "image/jpeg",
          byteSize: jpeg.byteLength,
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: "ASSIGNMENT_NOT_FOUND" });
  });

  it("rejects spoofed media and reopens provisional completion", async () => {
    const { principals, snapshot } = await startedRoom();
    const owner = principals[0];
    const own = await games.snapshot(owner);
    const assignmentId = own.assignments[0].id;
    const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "blue" } })
      .png()
      .toBuffer();
    const intent = await evidence.createUploadIntent(
      owner,
      assignmentId,
      {
        expectedStateVersion: snapshot.stateVersion,
        contentType: "image/jpeg",
        byteSize: png.byteLength,
      },
      randomUUID(),
    );
    storage.seed(png, "image/jpeg");
    await evidence.confirm(
      owner,
      assignmentId,
      { expectedStateVersion: snapshot.stateVersion, uploadId: intent.uploadId },
      randomUUID(),
    );
    await evidence.runNextJob("test-worker");
    expect(
      (await games.snapshot(owner)).assignments.find((a) => a.id === assignmentId)?.status,
    ).toBe("assigned");
  });

  it("deletes expired orphans and verifies terminal retention deletion", async () => {
    const { principals, snapshot } = await startedRoom();
    const owner = principals[0];
    const own = await games.snapshot(owner);
    const image = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "yellow" },
    })
      .jpeg()
      .toBuffer();

    const orphan = await evidence.createUploadIntent(
      owner,
      own.assignments[0].id,
      {
        expectedStateVersion: snapshot.stateVersion,
        contentType: "image/jpeg",
        byteSize: image.byteLength,
      },
      randomUUID(),
    );
    const orphanKey = storage.lastKey!;
    storage.seed(image, "image/jpeg");
    await dependencies.db
      .updateTable("app.jobs")
      .set({ run_at: new Date() })
      .where("deduplication_key", "=", `orphan:${orphan.uploadId}`)
      .execute();
    await evidence.runNextJob("cleanup-worker");
    expect(storage.objects.has(orphanKey)).toBe(false);

    const intent = await evidence.createUploadIntent(
      owner,
      own.assignments[1].id,
      {
        expectedStateVersion: snapshot.stateVersion,
        contentType: "image/jpeg",
        byteSize: image.byteLength,
      },
      randomUUID(),
    );
    storage.seed(image, "image/jpeg");
    const confirmed = await evidence.confirm(
      owner,
      own.assignments[1].id,
      { expectedStateVersion: snapshot.stateVersion, uploadId: intent.uploadId },
      randomUUID(),
    );
    await evidence.runNextJob("cleanup-worker");
    await dependencies.db
      .updateTable("app.rooms")
      .set({ status: "completed", expires_at: new Date() })
      .where("id", "=", owner.roomId)
      .execute();
    expect(await evidence.scheduleTerminalRetention()).toBeGreaterThan(0);
    await dependencies.db
      .updateTable("app.jobs")
      .set({ run_at: new Date() })
      .where("deduplication_key", "=", `delete:${confirmed.submission.id}`)
      .execute();
    await evidence.runNextJob("cleanup-worker");
    const deleted = await dependencies.db
      .selectFrom("app.task_submissions")
      .select(["processing_status", "deleted_at"])
      .where("id", "=", confirmed.submission.id)
      .executeTakeFirstOrThrow();
    expect(deleted.processing_status).toBe("deleted");
    expect(deleted.deleted_at).not.toBeNull();
  });

  it("finishes a full game with the last real crew evidence submission", async () => {
    const { principals, snapshot } = await startedRoom();
    const realAssignments = await dependencies.db
      .selectFrom("app.task_assignments")
      .select(["id", "participant_id"])
      .where("game_id", "=", snapshot.id)
      .where("counts_toward_progress", "=", true)
      .execute();
    const last = realAssignments[0];
    await dependencies.db
      .updateTable("app.task_assignments")
      .set({ status: "completed", completed_at: new Date() })
      .where("game_id", "=", snapshot.id)
      .where("counts_toward_progress", "=", true)
      .where("id", "!=", last.id)
      .execute();
    const owner = principals.find((principal) => principal.participantId === last.participant_id)!;
    const image = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "green" },
    })
      .jpeg()
      .toBuffer();
    const intent = await evidence.createUploadIntent(
      owner,
      last.id,
      {
        expectedStateVersion: snapshot.stateVersion,
        contentType: "image/jpeg",
        byteSize: image.byteLength,
      },
      randomUUID(),
    );
    storage.seed(image, "image/jpeg");
    const confirmation = await evidence.confirm(
      owner,
      last.id,
      { expectedStateVersion: snapshot.stateVersion, uploadId: intent.uploadId },
      randomUUID(),
    );
    expect(confirmation.progress.percent).toBe(100);
    expect(await games.snapshot(owner)).toMatchObject({ phase: "game_over", winner: "crew" });
  });
});
