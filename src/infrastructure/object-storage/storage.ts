import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
}

export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client;

  constructor(private readonly config: AppConfig) {
    this.client = new S3Client({
      region: config.evidenceS3Region,
      endpoint: config.evidenceS3Endpoint,
      forcePathStyle: config.evidenceS3ForcePathStyle,
      maxAttempts: config.evidenceS3MaxAttempts,
    });
  }

  private async withTimeout<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.evidenceS3RequestTimeoutMs);
    timer.unref();
    try {
      return await operation(controller.signal);
    } finally {
      clearTimeout(timer);
    }
  }

  async createUploadCapability(input: {
    objectKey: string;
    contentType: string;
    byteSize: number;
    checksum: string | null;
    expiresAt: Date;
  }): Promise<UploadCapability> {
    const command = new PutObjectCommand({
      Bucket: this.config.evidenceBucket,
      Key: input.objectKey,
      ContentType: input.contentType,
      ContentLength: input.byteSize,
      ChecksumSHA256: input.checksum ?? undefined,
      Metadata: { upload: "evidence" },
    });
    const seconds = Math.max(1, Math.floor((input.expiresAt.getTime() - Date.now()) / 1000));
    const url = await getSignedUrl(this.client, command, { expiresIn: seconds });
    const headers: Record<string, string> = {
      "content-type": input.contentType,
      "content-length": String(input.byteSize),
    };
    if (input.checksum) headers["x-amz-checksum-sha256"] = input.checksum;
    return { method: "PUT", url, headers, expiresAt: input.expiresAt };
  }

  async head(objectKey: string): Promise<StoredObjectMetadata | null> {
    try {
      const result = await this.withTimeout((abortSignal) =>
        this.client.send(
          new HeadObjectCommand({ Bucket: this.config.evidenceBucket, Key: objectKey }),
          { abortSignal },
        ),
      );
      return {
        byteSize: result.ContentLength ?? 0,
        contentType: result.ContentType ?? null,
        checksum: result.ChecksumSHA256 ?? null,
      };
    } catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode;
      if (status === 404) return null;
      throw error;
    }
  }

  async read(objectKey: string): Promise<Uint8Array> {
    const result = await this.withTimeout((abortSignal) =>
      this.client.send(
        new GetObjectCommand({ Bucket: this.config.evidenceBucket, Key: objectKey }),
        {
          abortSignal,
        },
      ),
    );
    if (!result.Body) throw new Error("STORAGE_OBJECT_EMPTY");
    return result.Body.transformToByteArray();
  }

  async replace(objectKey: string, bytes: Uint8Array, contentType: string): Promise<void> {
    await this.withTimeout((abortSignal) =>
      this.client.send(
        new PutObjectCommand({
          Bucket: this.config.evidenceBucket,
          Key: objectKey,
          Body: bytes,
          ContentType: contentType,
          ContentLength: bytes.byteLength,
          Metadata: { normalized: "true" },
        }),
        { abortSignal },
      ),
    );
  }

  createReadUrl(objectKey: string, expiresAt: Date): Promise<string> {
    const seconds = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.config.evidenceBucket,
        Key: objectKey,
        ResponseContentType: "image/webp",
        ResponseCacheControl: "private, no-store",
      }),
      { expiresIn: seconds },
    );
  }

  async delete(objectKey: string): Promise<void> {
    await this.withTimeout((abortSignal) =>
      this.client.send(
        new DeleteObjectCommand({ Bucket: this.config.evidenceBucket, Key: objectKey }),
        { abortSignal },
      ),
    );
  }
}
