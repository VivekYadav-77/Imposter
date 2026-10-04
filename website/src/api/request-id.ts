import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

const VALID_REQUEST_ID = /^[A-Za-z0-9_-]{1,128}$/;

export function resolveRequestId(request: IncomingMessage): string {
  const candidate = request.headers["x-request-id"];
  if (typeof candidate === "string" && VALID_REQUEST_ID.test(candidate)) return candidate;
  return `req_${randomUUID()}`;
}
