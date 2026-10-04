import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

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

  it("removes partial files when a streamed body ends early", async () => {
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
    const objectKey = "games/game/participants/player/partial.upload";
    const upload = await storage.createUploadCapability({
      objectKey,
      contentType: "image/png",
      byteSize: 10,
      checksum: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      storage.acceptLocalUploadCapability(
        upload.url.split("/").at(-1)!,
        Readable.from(Buffer.from("short")),
        "image/png",
      ),
    ).rejects.toThrow("STORAGE_OBJECT_MISMATCH");
    await expect(storage.head(objectKey)).resolves.toBeNull();
    await expect(stat(path.join(directory, `${objectKey}.uploading`))).rejects.toMatchObject({
      code: "ENOENT",
    });
  });

  it("streams uploads through a bounded queue and makes retries idempotent", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "imposter-evidence-"));
    directories.push(directory);
    const storage = new LocalObjectStorage(
      loadConfig({
        APP_ENV: "test",
        DATABASE_URL: "postgresql://localhost/imposter_test",
        PARTICIPANT_SESSION_TOKEN_PEPPER: "local-storage-test-pepper-32-characters",
        EVIDENCE_LOCAL_DIRECTORY: directory,
        EVIDENCE_UPLOAD_MAX_CONCURRENT: "1",
        EVIDENCE_UPLOAD_MAX_QUEUED: "1",
      }),
    );
    const bytes = Buffer.from("streamed-private-image");
    const upload = await storage.createUploadCapability({
      objectKey: "games/game/participants/player/streamed.upload",
      contentType: "image/webp",
      byteSize: bytes.byteLength,
      checksum: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const token = upload.url.split("/").at(-1)!;
    const firstSource = new PassThrough();
    const first = storage.acceptLocalUploadCapability(
      token,
      firstSource,
      "image/webp",
      bytes.byteLength,
    );
    const claim = path.join(directory, "games/game/participants/player/streamed.upload.uploading");
    await vi.waitFor(async () => expect((await stat(claim)).isFile()).toBe(true));

    const retry = storage.acceptLocalUploadCapability(
      token,
      Readable.from(bytes),
      "image/webp",
      bytes.byteLength,
    );
    firstSource.end(bytes);
    await expect(Promise.all([first, retry])).resolves.toEqual([undefined, undefined]);
    expect(
      Buffer.from(await storage.read("games/game/participants/player/streamed.upload")),
    ).toEqual(bytes);
  });

  it("rejects excess queued uploads without buffering their bodies", async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "imposter-evidence-"));
    directories.push(directory);
    const storage = new LocalObjectStorage(
      loadConfig({
        APP_ENV: "test",
        DATABASE_URL: "postgresql://localhost/imposter_test",
        PARTICIPANT_SESSION_TOKEN_PEPPER: "local-storage-test-pepper-32-characters",
        EVIDENCE_LOCAL_DIRECTORY: directory,
        EVIDENCE_UPLOAD_MAX_CONCURRENT: "1",
        EVIDENCE_UPLOAD_MAX_QUEUED: "0",
      }),
    );
    const firstUpload = await storage.createUploadCapability({
      objectKey: "games/game/participants/player/first.upload",
      contentType: "image/webp",
      byteSize: 1,
      checksum: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const secondUpload = await storage.createUploadCapability({
      objectKey: "games/game/participants/player/second.upload",
      contentType: "image/webp",
      byteSize: 1,
      checksum: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const held = new PassThrough();
    const first = storage.acceptLocalUploadCapability(
      firstUpload.url.split("/").at(-1)!,
      held,
      "image/webp",
      1,
    );
    await vi.waitFor(() => expect(held.readableFlowing).not.toBeNull());
    await expect(
      storage.acceptLocalUploadCapability(
        secondUpload.url.split("/").at(-1)!,
        Readable.from(Buffer.from("b")),
        "image/webp",
        1,
      ),
    ).rejects.toThrow("STORAGE_BUSY");
    held.end("a");
    await first;
  });
});
