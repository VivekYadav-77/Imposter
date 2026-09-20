import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadConfig } from "../../src/infrastructure/configuration/config.js";
import { LocalObjectStorage } from "../../src/infrastructure/object-storage/storage.js";

describe("local evidence object storage", () => {
  const directories: string[] = [];
  afterEach(async () => {
    await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
  });

  it("accepts a signed upload and serves the same private object through a signed read URL", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "imposter-evidence-"));
    directories.push(directory);
    const storage = new LocalObjectStorage(
      loadConfig({
        APP_ENV: "test",
        DATABASE_URL: "postgresql://localhost/imposter_test",
        PARTICIPANT_SESSION_TOKEN_PEPPER: "local-storage-test-pepper-32-characters",
        EVIDENCE_LOCAL_DIRECTORY: directory,
      }),
    );
    const bytes = new TextEncoder().encode("private-image-bytes");
    const upload = await storage.createUploadCapability({
      objectKey: "games/game/participants/player/evidence.upload",
      contentType: "image/webp",
      byteSize: bytes.byteLength,
      checksum: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const uploadToken = upload.url.split("/").at(-1)!;
    await storage.acceptLocalCapability(uploadToken, bytes, "image/webp");

    expect(await storage.head("games/game/participants/player/evidence.upload")).toMatchObject({
      byteSize: bytes.byteLength,
      contentType: "image/webp",
    });
    const readUrl = await storage.createReadUrl(
      "games/game/participants/player/evidence.upload",
      new Date(Date.now() + 60_000),
    );
    const read = await storage.acceptLocalCapability(readUrl.split("/").at(-1)!);
    expect(read.contentType).toBe("image/webp");
    expect(Buffer.from(read.bytes!).toString("utf8")).toBe("private-image-bytes");
  });

  it("rejects a file that does not match the signed byte size", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "imposter-evidence-"));
    directories.push(directory);
    const storage = new LocalObjectStorage(
      loadConfig({
        APP_ENV: "test",
        DATABASE_URL: "postgresql://localhost/imposter_test",
        PARTICIPANT_SESSION_TOKEN_PEPPER: "local-storage-test-pepper-32-characters",
        EVIDENCE_LOCAL_DIRECTORY: directory,
      }),
    );
    const upload = await storage.createUploadCapability({
      objectKey: "games/game/participants/player/evidence.upload",
      contentType: "image/png",
      byteSize: 10,
      checksum: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await expect(
      storage.acceptLocalCapability(upload.url.split("/").at(-1)!, new Uint8Array(2), "image/png"),
    ).rejects.toThrow("STORAGE_OBJECT_MISMATCH");
  });
});
