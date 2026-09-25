import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, open, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { AppConfig } from "../configuration/config.js";

export interface StoredObjectMetadata {
  byteSize: number;
  contentType: string | null;
  checksum: string | null;
}
export interface UploadCapability {
  method: "PUT";
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface ObjectStorage {
  createUploadCapability(input: {
    objectKey: string;
    contentType: string;
    byteSize: number;
    checksum: string | null;
    expiresAt: Date;
  }): Promise<UploadCapability>;
  head(objectKey: string): Promise<StoredObjectMetadata | null>;
  read(objectKey: string): Promise<Uint8Array>;
  replace(objectKey: string, bytes: Uint8Array, contentType: string): Promise<void>;
  createReadUrl(objectKey: string, expiresAt: Date): Promise<string>;
  delete(objectKey: string): Promise<void>;
  acceptLocalCapability?(
    token: string,
    bytes?: Uint8Array,
    contentType?: string,
  ): Promise<{
    bytes?: Uint8Array;
    contentType?: string;
  }>;
  acceptLocalUploadCapability?(
    token: string,
    source: Readable,
    contentType: string,
    contentLength?: number,
  ): Promise<void>;
}

type LocalCapability = {
  action: "put" | "get";
  key: string;
  exp: number;
  contentType?: string;
  byteSize?: number;
  checksum?: string | null;
};

type UploadWaiter = {
  active: boolean;
  source: Readable;
  resolve: (release: () => void) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
  cancel: () => void;
};

class UploadAdmissionGate {
  private active = 0;
  private readonly waiting: UploadWaiter[] = [];

  constructor(
    private readonly maximumConcurrent: number,
    private readonly maximumQueued: number,
    private readonly queueTimeoutMs: number,
  ) {}

  acquire(source: Readable): Promise<() => void> {
    if (source.destroyed) return Promise.reject(new Error("UPLOAD_ABORTED"));
    if (this.active < this.maximumConcurrent) {
      this.active += 1;
      return Promise.resolve(this.releaseOnce());
    }
    if (this.waiting.length >= this.maximumQueued) return Promise.reject(new Error("STORAGE_BUSY"));

    return new Promise((resolve, reject) => {
      const waiter = {} as UploadWaiter;
      const cancel = () => {
        if (!waiter.active) return;
        waiter.active = false;
        clearTimeout(waiter.timer);
        source.off("aborted", cancel);
        const index = this.waiting.indexOf(waiter);
        if (index >= 0) this.waiting.splice(index, 1);
        reject(new Error("UPLOAD_ABORTED"));
      };
      Object.assign(waiter, {
        active: true,
        source,
        resolve,
        reject,
        cancel,
        timer: setTimeout(() => {
          if (!waiter.active) return;
          waiter.active = false;
          source.off("aborted", cancel);
          const index = this.waiting.indexOf(waiter);
          if (index >= 0) this.waiting.splice(index, 1);
          reject(new Error("STORAGE_BUSY"));
        }, this.queueTimeoutMs),
      });
      source.once("aborted", cancel);
      this.waiting.push(waiter);
    });
  }

  private releaseOnce(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
      this.admitNext();
    };
  }

  private admitNext(): void {
    while (this.active < this.maximumConcurrent) {
      const waiter = this.waiting.shift();
      if (!waiter) return;
      if (!waiter.active || waiter.source.destroyed) {
        if (waiter.active) waiter.cancel();
        continue;
      }
      waiter.active = false;
      clearTimeout(waiter.timer);
      waiter.source.off("aborted", waiter.cancel);
      this.active += 1;
      waiter.resolve(this.releaseOnce());
    }
  }
}

export class LocalObjectStorage implements ObjectStorage {
  private readonly root: string;
  private readonly uploadGate: UploadAdmissionGate;

  constructor(private readonly config: AppConfig) {
    this.root = path.resolve(config.evidenceLocalDirectory);
    this.uploadGate = new UploadAdmissionGate(
      config.evidenceUploadMaxConcurrent,
      config.evidenceUploadMaxQueued,
      config.evidenceUploadQueueTimeoutMs,
    );
  }

  private objectPath(objectKey: string): string {
    if (!/^[A-Za-z0-9/_-]+(?:\.[A-Za-z0-9]+)?$/.test(objectKey))
      throw new Error("INVALID_OBJECT_KEY");
    const resolved = path.resolve(this.root, objectKey);
    if (resolved !== this.root && !resolved.startsWith(`${this.root}${path.sep}`))
      throw new Error("INVALID_OBJECT_KEY");
    return resolved;
  }

  private token(payload: LocalCapability): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = createHmac("sha256", this.config.participantSessionTokenPepper)
      .update(encoded)
      .digest("base64url");
    return `${encoded}.${signature}`;
  }

  private verify(token: string): LocalCapability {
    const [encoded, supplied, extra] = token.split(".");
    if (!encoded || !supplied || extra) throw new Error("INVALID_STORAGE_CAPABILITY");
    const expected = createHmac("sha256", this.config.participantSessionTokenPepper)
      .update(encoded)
      .digest("base64url");
    const actualBytes = Buffer.from(supplied);
    const expectedBytes = Buffer.from(expected);
    if (actualBytes.length !== expectedBytes.length || !timingSafeEqual(actualBytes, expectedBytes))
      throw new Error("INVALID_STORAGE_CAPABILITY");
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as LocalCapability;
    if (payload.exp < Date.now() || !["put", "get"].includes(payload.action))
      throw new Error("EXPIRED_STORAGE_CAPABILITY");
    this.objectPath(payload.key);
    return payload;
  }

  createUploadCapability(input: {
    objectKey: string;
    contentType: string;
    byteSize: number;
    checksum: string | null;
    expiresAt: Date;
  }): Promise<UploadCapability> {
    const token = this.token({
      action: "put",
      key: input.objectKey,
      exp: input.expiresAt.getTime(),
      contentType: input.contentType,
      byteSize: input.byteSize,
      checksum: input.checksum,
    });
    return Promise.resolve({
      method: "PUT",
      url: `/api/v1/evidence-objects/${token}`,
      headers: { "content-type": input.contentType },
      expiresAt: input.expiresAt,
    });
  }

  async acceptLocalCapability(token: string, bytes?: Uint8Array, contentType?: string) {
    const capability = this.verify(token);
    if (capability.action === "put") {
      const expectedType = capability.contentType;
      if (
        !bytes ||
        !contentType ||
        !expectedType ||
        bytes.byteLength !== capability.byteSize ||
        contentType !== expectedType
      )
        throw new Error("STORAGE_OBJECT_MISMATCH");
      await this.acceptLocalUploadCapability(
        token,
        Readable.from(Buffer.from(bytes)),
        contentType,
        bytes.byteLength,
      );
      return {};
    }
    if (bytes) throw new Error("INVALID_STORAGE_CAPABILITY");
    const objectBytes = await this.read(capability.key);
    const metadata = await this.head(capability.key);
    return { bytes: objectBytes, contentType: metadata?.contentType ?? "application/octet-stream" };
  }

  async acceptLocalUploadCapability(
    token: string,
    source: Readable,
    contentType: string,
    contentLength?: number,
  ): Promise<void> {
    const capability = this.verify(token);
    if (
      capability.action !== "put" ||
      !capability.contentType ||
      !capability.byteSize ||
      contentType !== capability.contentType ||
      (contentLength !== undefined && contentLength !== capability.byteSize)
    )
      throw new Error("STORAGE_OBJECT_MISMATCH");
    const expectedByteSize = capability.byteSize;

    const release = await this.uploadGate.acquire(source);
    const file = this.objectPath(capability.key);
    const claim = `${file}.uploading`;
    const temporaryFile = `${file}.upload.part`;
    const temporaryMetadata = `${file}.meta.upload.part`;
    let claimHandle: Awaited<ReturnType<typeof open>> | undefined;
    try {
      const existing = await this.head(capability.key);
      if (existing) {
        if (
          existing.byteSize === capability.byteSize &&
          existing.contentType === capability.contentType &&
          (!capability.checksum || existing.checksum === capability.checksum)
        ) {
          source.resume();
          return;
        }
        throw new Error("STORAGE_CAPABILITY_USED");
      }
      await mkdir(path.dirname(file), { recursive: true });
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          claimHandle = await open(claim, "wx");
          break;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
          const completed = await this.head(capability.key);
          if (
            completed?.byteSize === capability.byteSize &&
            completed.contentType === capability.contentType
          ) {
            source.resume();
            return;
          }
          const claimDetails = await stat(claim).catch(() => null);
          const staleAfterMs =
            this.config.httpRequestTimeoutMs + this.config.evidenceUploadQueueTimeoutMs + 5_000;
          if (attempt === 0 && claimDetails && Date.now() - claimDetails.mtimeMs > staleAfterMs) {
            await Promise.all(
              [claim, temporaryFile, temporaryMetadata].map((target) =>
                unlink(target).catch((unlinkError: NodeJS.ErrnoException) => {
                  if (unlinkError.code !== "ENOENT") throw unlinkError;
                }),
              ),
            );
            continue;
          }
          throw new Error("STORAGE_UPLOAD_IN_PROGRESS");
        }
      }
      if (!claimHandle) throw new Error("STORAGE_UPLOAD_IN_PROGRESS");

      const unindexedObject = await stat(file).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      if (unindexedObject) {
        if (unindexedObject.size !== expectedByteSize) throw new Error("STORAGE_CAPABILITY_USED");
        const recoveredChecksum = capability.checksum
          ? createHash("sha256")
              .update(await readFile(file))
              .digest("base64")
          : null;
        if (capability.checksum && recoveredChecksum !== capability.checksum)
          throw new Error("STORAGE_CAPABILITY_USED");
        await unlink(`${file}.meta.json`).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
        });
        await writeFile(
          temporaryMetadata,
          JSON.stringify({
            byteSize: expectedByteSize,
            contentType,
            checksum: recoveredChecksum,
          }),
          { flag: "wx" },
        );
        await rename(temporaryMetadata, `${file}.meta.json`);
        source.resume();
        return;
      }
      await unlink(`${file}.meta.json`).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });

      let byteSize = 0;
      const digest = createHash("sha256");
      const validator = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          byteSize += chunk.byteLength;
          if (byteSize > expectedByteSize) {
            callback(new Error("STORAGE_OBJECT_MISMATCH"));
            return;
          }
          digest.update(chunk);
          callback(null, chunk);
        },
      });
      await pipeline(source, validator, createWriteStream(temporaryFile, { flags: "wx" }));
      if (byteSize !== expectedByteSize) throw new Error("STORAGE_OBJECT_MISMATCH");
      const checksum = digest.digest("base64");
      if (capability.checksum && checksum !== capability.checksum)
        throw new Error("STORAGE_OBJECT_MISMATCH");

      await writeFile(temporaryMetadata, JSON.stringify({ byteSize, contentType, checksum }), {
        flag: "wx",
      });
      await rename(temporaryFile, file);
      await rename(temporaryMetadata, `${file}.meta.json`);
    } finally {
      await claimHandle?.close().catch(() => undefined);
      const cleanupTargets = [temporaryFile, temporaryMetadata];
      if (claimHandle) cleanupTargets.push(claim);
      await Promise.all(
        cleanupTargets.map((target) =>
          unlink(target).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== "ENOENT") throw error;
          }),
        ),
      );
      release();
    }
  }

  async head(objectKey: string): Promise<StoredObjectMetadata | null> {
    try {
      const file = this.objectPath(objectKey);
      const [details, metadata] = await Promise.all([
        stat(file),
        readFile(`${file}.meta.json`, "utf8").then(
          (value) => JSON.parse(value) as StoredObjectMetadata,
        ),
      ]);
      return { ...metadata, byteSize: details.size };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  read(objectKey: string): Promise<Uint8Array> {
    return readFile(this.objectPath(objectKey));
  }

  async replace(objectKey: string, bytes: Uint8Array, contentType: string): Promise<void> {
    const file = this.objectPath(objectKey);
    const temporaryFile = `${file}.replace.part`;
    const temporaryMetadata = `${file}.meta.replace.part`;
    await mkdir(path.dirname(file), { recursive: true });
    try {
      await writeFile(temporaryFile, bytes, { flag: "wx" });
      await writeFile(
        temporaryMetadata,
        JSON.stringify({ byteSize: bytes.byteLength, contentType, checksum: null }),
        { flag: "wx" },
      );
      await rename(temporaryFile, file);
      await rename(temporaryMetadata, `${file}.meta.json`);
    } finally {
      await Promise.all(
        [temporaryFile, temporaryMetadata].map((target) =>
          unlink(target).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== "ENOENT") throw error;
          }),
        ),
      );
    }
  }

  createReadUrl(objectKey: string, expiresAt: Date): Promise<string> {
    const token = this.token({ action: "get", key: objectKey, exp: expiresAt.getTime() });
    return Promise.resolve(`/api/v1/evidence-objects/${token}`);
  }

  async delete(objectKey: string): Promise<void> {
    const file = this.objectPath(objectKey);
    await Promise.all(
      [
        file,
        `${file}.meta.json`,
        `${file}.uploading`,
        `${file}.upload.part`,
        `${file}.meta.upload.part`,
        `${file}.replace.part`,
        `${file}.meta.replace.part`,
      ].map((target) =>
        unlink(target).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
        }),
      ),
    );
  }
}
