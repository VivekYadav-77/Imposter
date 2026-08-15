import type { IncomingMessage, ServerResponse } from "node:http";
import type { Logger } from "pino";

import type { Database } from "../infrastructure/database/database.js";
import { checkDatabaseReadiness } from "../infrastructure/database/database.js";
import type { AppConfig } from "../infrastructure/configuration/config.js";
import type { Metrics } from "../infrastructure/observability/metrics.js";
import { successEnvelope } from "../shared/contracts/envelope.js";
import { ApplicationError } from "../shared/errors/application-error.js";
import { sendError, sendJson } from "./http.js";
import { openApiDocument } from "./openapi.js";
import { resolveRequestId } from "./request-id.js";
import { applyCors, applySecurityHeaders } from "./security-headers.js";

export interface ApiDependencies {
  config: AppConfig;
  database: Database;
  logger: Logger;
  metrics: Metrics;
  readinessCheck?: () => Promise<void>;
}

export type ApiHandler = (request: IncomingMessage, response: ServerResponse) => Promise<boolean>;

export function createApiHandler(dependencies: ApiDependencies): ApiHandler {
  return async (request, response) => {
    const requestId = resolveRequestId(request);
    const startedAt = performance.now();
    applySecurityHeaders(response);

    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    const isOwnedPath = path.startsWith("/api/") || path.startsWith("/health/");
    if (!isOwnedPath) return false;

    response.setHeader("Cache-Control", "no-store");
    if (!applyCors(request, response, dependencies.config)) {
      sendError(
        response,
        new ApplicationError(403, "FORBIDDEN", "Origin is not allowed."),
        requestId,
      );
      return true;
    }
    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      response.setHeader("X-Request-ID", requestId);
      response.end();
      return true;
    }

    const contentLength = Number(request.headers["content-length"] ?? 0);
    if (Number.isFinite(contentLength) && contentLength > dependencies.config.maxJsonBodyBytes) {
      sendError(
        response,
        new ApplicationError(413, "PAYLOAD_TOO_LARGE", "The request body is too large."),
        requestId,
      );
      return true;
    }

    try {
      if (request.method === "GET" && path === "/health/live") {
        sendJson(response, 200, successEnvelope({ status: "ok" }, requestId), requestId);
      } else if (request.method === "GET" && path === "/health/ready") {
        try {
          await (dependencies.readinessCheck?.() ??
            checkDatabaseReadiness(
              dependencies.database,
              dependencies.config.databaseReadyTimeoutMs,
            ));
          sendJson(response, 200, successEnvelope({ status: "ok" }, requestId), requestId);
        } catch (error) {
          dependencies.logger.warn(
            { err: error, requestId, dependency: "postgres" },
            "Readiness dependency failed",
          );
          throw new ApplicationError(
            503,
            "DEPENDENCY_UNAVAILABLE",
            "A required dependency is unavailable.",
          );
        }
      } else if (request.method === "GET" && path === "/api/v1") {
        sendJson(response, 200, successEnvelope({ version: "v1" }, requestId), requestId);
      } else if (
        request.method === "GET" &&
        path === "/api/openapi.json" &&
        dependencies.config.exposeApiDocs
      ) {
        sendJson(response, 200, openApiDocument, requestId);
      } else {
        throw new ApplicationError(404, "NOT_FOUND", "The requested resource was not found.");
      }
    } catch (error) {
      if (!(error instanceof ApplicationError)) {
        dependencies.logger.error({ err: error, requestId }, "Unhandled API error");
      }
      sendError(response, error, requestId);
    } finally {
      const durationMs = performance.now() - startedAt;
      dependencies.metrics.increment("http.requests", {
        method: request.method ?? "UNKNOWN",
        path,
      });
      dependencies.metrics.observe("http.request.duration_ms", durationMs, { path });
      dependencies.logger.info(
        { requestId, method: request.method, path, status: response.statusCode, durationMs },
        "HTTP request completed",
      );
    }
    return true;
  };
}
