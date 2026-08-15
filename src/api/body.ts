import type { IncomingMessage } from "node:http";

import { ApplicationError } from "../shared/errors/application-error.js";

export async function readJsonBody<T>(request: IncomingMessage, maximumBytes: number): Promise<T> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    size += buffer.byteLength;
    if (size > maximumBytes) {
      throw new ApplicationError(413, "PAYLOAD_TOO_LARGE", "The request body is too large.");
    }
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
  } catch {
    throw new ApplicationError(400, "BAD_REQUEST", "The request body is not valid JSON.");
  }
}
