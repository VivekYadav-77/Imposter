import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

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
}

type LocalCapability = {
  action: "put" | "get";
  key: string;
  exp: number;
  contentType?: string;
  byteSize?: number;
};

export class LocalObjectStorage implements ObjectStorage {
  private readonly root: string;

  constructor(private readonly config: AppConfig) {
    this.root = path.resolve(config.evidenceLocalDirectory);
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
    void input.checksum;
    const token = this.token({
      action: "put",
      key: input.objectKey,
      exp: input.expiresAt.getTime(),
      contentType: input.contentType,
      byteSize: input.byteSize,
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
      await this.replace(capability.key, bytes, contentType);
      return {};
    }
    if (bytes) throw new Error("INVALID_STORAGE_CAPABILITY");
    const objectBytes = await this.read(capability.key);
    const metadata = await this.head(capability.key);
    return { bytes: objectBytes, contentType: metadata?.contentType ?? "application/octet-stream" };
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
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes, { flag: "w" });
    await writeFile(
      `${file}.meta.json`,
      JSON.stringify({ byteSize: bytes.byteLength, contentType, checksum: null }),
      { flag: "w" },
    );
  }

  createReadUrl(objectKey: string, expiresAt: Date): Promise<string> {
    const token = this.token({ action: "get", key: objectKey, exp: expiresAt.getTime() });
    return Promise.resolve(`/api/v1/evidence-objects/${token}`);
  }

  async delete(objectKey: string): Promise<void> {
    const file = this.objectPath(objectKey);
    await Promise.all(
      [file, `${file}.meta.json`].map((target) =>
        unlink(target).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
        }),
      ),
    );
  }
}
