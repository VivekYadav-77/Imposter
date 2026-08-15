import type { ServerResponse } from "node:http";

import type { ErrorEnvelope } from "../shared/contracts/envelope.js";
import { toApplicationError } from "../shared/errors/application-error.js";

export function sendJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  requestId: string,
): void {
  const payload = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", Buffer.byteLength(payload));
  response.setHeader("X-Request-ID", requestId);
  response.end(payload);
}

export function sendError(response: ServerResponse, error: unknown, requestId: string): void {
  const safeError = toApplicationError(error);
  const body: ErrorEnvelope = {
    error: {
      code: safeError.code,
      message: safeError.message,
      ...(safeError.details ? { details: safeError.details } : {}),
      requestId,
    },
  };
  sendJson(response, safeError.status, body, requestId);
}
