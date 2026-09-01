import type { IncomingMessage, ServerResponse } from "node:http";
import type { Logger } from "pino";

import type { Database } from "../infrastructure/database/database.js";
import { checkDatabaseReadiness } from "../infrastructure/database/database.js";
import type { AppConfig } from "../infrastructure/configuration/config.js";
import type { Metrics } from "../infrastructure/observability/metrics.js";
import type { AdminAuthService } from "../modules/admin-auth/service.js";
import {
  createPackSchema,
  loginSchema,
  revisionSchema,
  updatePackSchema,
} from "../modules/task-packs/schemas.js";
import type { TaskPackRepository } from "../modules/task-packs/repository.js";
import {
  emptyBodySchema,
  roomMembershipSchema,
  roomSettingsSchema,
} from "../modules/rooms/schemas.js";
import type { RoomService } from "../modules/rooms/service.js";
import type { ParticipantPrincipal } from "../modules/rooms/types.js";
import type { GameService } from "../modules/games/service.js";
import { startGameSchema } from "../modules/games/schemas.js";
import type { EvidenceService } from "../modules/evidence/service.js";
import {
  confirmSubmissionSchema,
  flagSubmissionSchema,
  uploadIntentSchema,
} from "../modules/evidence/schemas.js";
import { successEnvelope } from "../shared/contracts/envelope.js";
import { ApplicationError } from "../shared/errors/application-error.js";
import {
  ADMIN_COOKIE_NAME,
  adminSessionCookie,
  clearAdminSessionCookie,
  clearParticipantSessionCookie,
  PARTICIPANT_COOKIE_NAME,
  participantSessionCookie,
  readCookie,
} from "../shared/security/cookies.js";
import { readJsonBody } from "./body.js";
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
  adminAuth?: AdminAuthService;
  taskPacks?: TaskPackRepository;
  rooms?: RoomService;
  games?: GameService;
  evidence?: EvidenceService;
  authorizePublishedPackRead?: (request: IncomingMessage) => Promise<void>;
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
      } else if (dependencies.rooms && isGameRoute(path)) {
        if (!dependencies.games)
          throw new ApplicationError(404, "NOT_FOUND", "The requested resource was not found.");
        await handleGameRoute(
          request,
          response,
          path,
          requestId,
          dependencies.rooms,
          dependencies.games,
          dependencies.evidence,
          dependencies.config,
        );
      } else if (dependencies.rooms && isRoomRoute(path)) {
        await handleRoomRoute(
          request,
          response,
          path,
          requestId,
          dependencies.rooms,
          dependencies.games,
          dependencies.config,
        );
      } else if (dependencies.adminAuth && dependencies.taskPacks && path.startsWith("/api/v1/")) {
        await handlePhaseTwoRoute(request, response, path, requestId, {
          ...dependencies,
          adminAuth: dependencies.adminAuth,
          taskPacks: dependencies.taskPacks,
        });
      } else {
        throw new ApplicationError(404, "NOT_FOUND", "The requested resource was not found.");
      }
    } catch (error) {
      if (error instanceof ApplicationError && error.status === 429) {
        const retryAfter = error.details?.retryAfterSeconds;
        if (typeof retryAfter === "number") response.setHeader("Retry-After", String(retryAfter));
      }
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

function isRoomRoute(path: string): boolean {
  return (
    path === "/api/v1/rooms" ||
    path.startsWith("/api/v1/rooms/") ||
    path.startsWith("/api/v1/participant-sessions/")
  );
}

function isGameRoute(path: string): boolean {
  return (
    path === "/api/v1/games/current/snapshot" ||
    path === "/api/v1/games/current/submissions" ||
    /^\/api\/v1\/task-assignments\/[0-9a-f-]+\/(upload-intents|submissions)$/i.test(path) ||
    /^\/api\/v1\/submissions\/[0-9a-f-]+\/flags$/i.test(path)
  );
}

function bearerCredential(request: IncomingMessage): string | null {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) return null;
  const value = authorization.slice(7).trim();
  return value || null;
}

function participantCredential(request: IncomingMessage): string | null {
  return bearerCredential(request) ?? readCookie(request, PARTICIPANT_COOKIE_NAME);
}

async function participantPrincipal(
  request: IncomingMessage,
  rooms: RoomService,
): Promise<ParticipantPrincipal> {
  const credential = participantCredential(request);
  const principal = credential ? await rooms.authenticate(credential) : null;
  if (!principal)
    throw new ApplicationError(
      401,
      "SESSION_INVALID",
      "An active participant session is required.",
    );
  return principal;
}

function usesCookieTransport(request: IncomingMessage): boolean {
  return (
    request.headers["x-session-transport"] === "cookie" ||
    (!bearerCredential(request) && Boolean(readCookie(request, PARTICIPANT_COOKIE_NAME)))
  );
}

function sendIssuedSession(
  request: IncomingMessage,
  response: ServerResponse,
  status: number,
  issued: Awaited<ReturnType<RoomService["createRoom"]>>,
  requestId: string,
  config: AppConfig,
): void {
  if (usesCookieTransport(request)) {
    const maxAge = Math.max(
      0,
      Math.floor((Date.parse(issued.sessionExpiresAt) - Date.now()) / 1000),
    );
    response.setHeader("Set-Cookie", participantSessionCookie(issued.sessionToken, maxAge));
    const safe = {
      room: issued.room,
      participant: issued.participant,
      sessionExpiresAt: issued.sessionExpiresAt,
    };
    sendJson(response, status, successEnvelope(safe, requestId), requestId);
    return;
  }
  sendJson(response, status, successEnvelope(issued, requestId), requestId);
  void config;
}

async function handleRoomRoute(
  request: IncomingMessage,
  response: ServerResponse,
  path: string,
  requestId: string,
  rooms: RoomService,
  games: GameService | undefined,
  config: AppConfig,
): Promise<void> {
  const method = request.method ?? "GET";
  const publicScope = `public:${request.socket.remoteAddress ?? "unknown"}`;
  if (method === "POST" && path === "/api/v1/rooms") {
    const key = requireIdempotencyKey(request);
    const body = await validatedBody(request, config.maxJsonBodyBytes, roomMembershipSchema);
    const issued = await rooms.createRoom(body, key, publicScope);
    sendIssuedSession(request, response, 201, issued, requestId, config);
    return;
  }
  const joinMatch = path.match(/^\/api\/v1\/rooms\/([A-Za-z0-9]{6})\/participants$/);
  if (method === "POST" && joinMatch) {
    const key = requireIdempotencyKey(request);
    const body = await validatedBody(request, config.maxJsonBodyBytes, roomMembershipSchema);
    const issued = await rooms.joinRoom(
      joinMatch[1],
      body,
      key,
      `${publicScope}:${joinMatch[1].toUpperCase()}`,
    );
    sendIssuedSession(request, response, 201, issued, requestId, config);
    return;
  }
  const principal = await participantPrincipal(request, rooms);
  if (["POST", "PATCH", "PUT", "DELETE"].includes(method) && usesCookieTransport(request))
    validateOriginForCookieMutation(request, config);
  if (method === "POST" && path === "/api/v1/rooms/current/start") {
    if (!games)
      throw new ApplicationError(404, "NOT_FOUND", "The requested resource was not found.");
    const key = requireIdempotencyKey(request);
    await validatedBody(request, config.maxJsonBodyBytes, startGameSchema);
    sendJson(
      response,
      201,
      successEnvelope(await games.start(principal, key), requestId),
      requestId,
    );
    return;
  }
  if (method === "GET" && path === "/api/v1/rooms/current") {
    sendJson(response, 200, successEnvelope(await rooms.snapshot(principal), requestId), requestId);
    return;
  }
  if (method === "PATCH" && path === "/api/v1/rooms/current/settings") {
    const key = requireIdempotencyKey(request);
    const body = await validatedBody(request, config.maxJsonBodyBytes, roomSettingsSchema);
    sendJson(
      response,
      200,
      successEnvelope(await rooms.updateSettings(principal, body, key), requestId),
      requestId,
    );
    return;
  }
  if (method === "POST" && path === "/api/v1/rooms/current/leave") {
    const key = requireIdempotencyKey(request);
    await validatedBody(request, config.maxJsonBodyBytes, emptyBodySchema);
    sendJson(
      response,
      200,
      successEnvelope(await rooms.leave(principal, key), requestId),
      requestId,
    );
    return;
  }
  if (method === "POST" && path === "/api/v1/participant-sessions/current/rotate") {
    const key = requireIdempotencyKey(request);
    await validatedBody(request, config.maxJsonBodyBytes, emptyBodySchema);
    const issued = await rooms.rotate(principal, key);
    if (usesCookieTransport(request)) {
      const maxAge = Math.max(
        0,
        Math.floor((Date.parse(issued.sessionExpiresAt) - Date.now()) / 1000),
      );
      response.setHeader("Set-Cookie", participantSessionCookie(issued.sessionToken, maxAge));
      sendJson(
        response,
        200,
        successEnvelope({ sessionExpiresAt: issued.sessionExpiresAt }, requestId),
        requestId,
      );
    } else sendJson(response, 200, successEnvelope(issued, requestId), requestId);
    return;
  }
  if (method === "DELETE" && path === "/api/v1/participant-sessions/current") {
    await rooms.revoke(principal);
    if (usesCookieTransport(request))
      response.setHeader("Set-Cookie", clearParticipantSessionCookie());
    response.statusCode = 204;
    response.setHeader("X-Request-ID", requestId);
    response.end();
    return;
  }
  throw new ApplicationError(404, "NOT_FOUND", "The requested resource was not found.");
}

async function handleGameRoute(
  request: IncomingMessage,
  response: ServerResponse,
  path: string,
  requestId: string,
  rooms: RoomService,
  games: GameService,
  evidence: EvidenceService | undefined,
  config: AppConfig,
): Promise<void> {
  const method = request.method ?? "GET";
  const principal = await participantPrincipal(request, rooms);
  if (["POST", "PATCH", "PUT", "DELETE"].includes(method) && usesCookieTransport(request))
    validateOriginForCookieMutation(request, config);
  if (method === "GET" && path === "/api/v1/games/current/snapshot") {
    const url = new URL(request.url ?? path, "http://localhost");
    const known = url.searchParams.get("knownStateVersion");
    if (known !== null && (!/^\d+$/.test(known) || !Number.isSafeInteger(Number(known))))
      throw new ApplicationError(
        422,
        "VALIDATION_FAILED",
        "knownStateVersion must be a non-negative integer.",
      );
    const snapshot = await games.snapshot(principal);
    response.setHeader("ETag", `"${snapshot.stateVersion}"`);
    if (known !== null && Number(known) === snapshot.stateVersion) {
      response.statusCode = 204;
      response.setHeader("X-Request-ID", requestId);
      response.end();
      return;
    }
    sendJson(response, 200, successEnvelope(snapshot, requestId), requestId);
    return;
  }
  const assignmentMatch = path.match(
    /^\/api\/v1\/task-assignments\/([0-9a-f-]+)\/(upload-intents|submissions)$/i,
  );
  if (method === "POST" && assignmentMatch) {
    if (!evidence)
      throw new ApplicationError(503, "STORAGE_UNAVAILABLE", "Evidence storage is unavailable.");
    const key = requireIdempotencyKey(request);
    if (assignmentMatch[2] === "upload-intents") {
      const body = await validatedBody(request, config.maxJsonBodyBytes, uploadIntentSchema);
      sendJson(
        response,
        201,
        successEnvelope(
          await evidence.createUploadIntent(principal, assignmentMatch[1], body, key),
          requestId,
        ),
        requestId,
      );
    } else {
      const body = await validatedBody(request, config.maxJsonBodyBytes, confirmSubmissionSchema);
      sendJson(
        response,
        201,
        successEnvelope(
          await evidence.confirm(principal, assignmentMatch[1], body, key),
          requestId,
        ),
        requestId,
      );
    }
    return;
  }
  if (method === "GET" && path === "/api/v1/games/current/submissions") {
    if (!evidence)
      throw new ApplicationError(503, "STORAGE_UNAVAILABLE", "Evidence storage is unavailable.");
    const url = new URL(request.url ?? path, "http://localhost");
    const limit = parseLimit(url);
    const flagged = url.searchParams.get("flagged") === "true";
    const fingerprint = `submissions:${flagged}`;
    const offset = parseCursor(url, fingerprint);
    const rows = await evidence.list(principal, flagged, limit + 1, offset);
    sendJson(
      response,
      200,
      successEnvelope(
        rows.slice(0, limit),
        requestId,
        nextCursor(offset, rows.length, limit, fingerprint),
      ),
      requestId,
    );
    return;
  }
  const flagMatch = path.match(/^\/api\/v1\/submissions\/([0-9a-f-]+)\/flags$/i);
  if (method === "POST" && flagMatch) {
    if (!evidence)
      throw new ApplicationError(503, "STORAGE_UNAVAILABLE", "Evidence storage is unavailable.");
    const key = requireIdempotencyKey(request);
    const body = await validatedBody(request, config.maxJsonBodyBytes, flagSubmissionSchema);
    sendJson(
      response,
      201,
      successEnvelope(await evidence.flag(principal, flagMatch[1], body, key), requestId),
      requestId,
    );
    return;
  }
  throw new ApplicationError(404, "NOT_FOUND", "The requested resource was not found.");
}

function requireIdempotencyKey(request: IncomingMessage): string {
  const key = request.headers["idempotency-key"];
  if (typeof key !== "string" || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
    throw new ApplicationError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "A valid Idempotency-Key header is required.",
    );
  }
  return key;
}

function parseLimit(url: URL): number {
  const value = url.searchParams.get("limit");
  if (!value) return 20;
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50)
    throw new ApplicationError(422, "VALIDATION_FAILED", "limit must be between 1 and 50.");
  return limit;
}

function parseCursor(url: URL, fingerprint: string): number {
  const cursor = url.searchParams.get("cursor");
  if (!cursor) return 0;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      offset?: unknown;
      fingerprint?: unknown;
    };
    if (
      !Number.isInteger(value.offset) ||
      (value.offset as number) < 0 ||
      value.fingerprint !== fingerprint
    )
      throw new Error("invalid");
    return value.offset as number;
  } catch {
    throw new ApplicationError(422, "VALIDATION_FAILED", "cursor is invalid for this listing.");
  }
}

function nextCursor(
  offset: number,
  count: number,
  limit: number,
  fingerprint: string,
): string | null {
  if (count <= limit) return null;
  return Buffer.from(JSON.stringify({ offset: offset + limit, fingerprint })).toString("base64url");
}

function validateOriginForCookieMutation(request: IncomingMessage, config: AppConfig): void {
  if (!request.headers.cookie) return;
  const origin = request.headers.origin;
  if (!origin || !config.corsAllowedOrigins.includes(origin))
    throw new ApplicationError(403, "FORBIDDEN", "A trusted Origin header is required.");
}

async function validatedBody<T>(
  request: IncomingMessage,
  maximumBytes: number,
  schema: {
    safeParse(
      value: unknown,
    ): { success: true; data: T } | { success: false; error: { flatten(): unknown } };
  },
): Promise<T> {
  const body = await readJsonBody<unknown>(request, maximumBytes);
  const result = schema.safeParse(body);
  if (!result.success)
    throw new ApplicationError(422, "VALIDATION_FAILED", "The request body is invalid.", {
      validation: result.error.flatten(),
    });
  return result.data;
}

async function handlePhaseTwoRoute(
  request: IncomingMessage,
  response: ServerResponse,
  path: string,
  requestId: string,
  dependencies: ApiDependencies & { adminAuth: AdminAuthService; taskPacks: TaskPackRepository },
): Promise<void> {
  const method = request.method ?? "GET";
  const url = new URL(request.url ?? "/", "http://localhost");
  if (method === "POST" && path === "/api/v1/admin/sessions") {
    const body = await validatedBody(request, dependencies.config.maxJsonBodyBytes, loginSchema);
    const session = await dependencies.adminAuth.login({
      email: body.email,
      password: body.password,
      ip: request.socket.remoteAddress ?? "unknown",
      requestId,
    });
    response.statusCode = 204;
    response.setHeader("Set-Cookie", adminSessionCookie(session.token, session.maxAgeSeconds));
    response.setHeader("X-Request-ID", requestId);
    response.end();
    return;
  }

  if (method === "GET" && path === "/api/v1/task-packs") {
    if (!dependencies.authorizePublishedPackRead)
      throw new ApplicationError(
        401,
        "SESSION_INVALID",
        "An active participant session is required.",
      );
    await dependencies.authorizePublishedPackRead(request);
    const search = url.searchParams.get("search")?.trim().slice(0, 80);
    const limit = parseLimit(url);
    const fingerprint = `public:${search ?? ""}`;
    const offset = parseCursor(url, fingerprint);
    const rows = await dependencies.taskPacks.listPublic(search, limit + 1, offset);
    sendJson(
      response,
      200,
      successEnvelope(
        rows.slice(0, limit),
        requestId,
        nextCursor(offset, rows.length, limit, fingerprint),
      ),
      requestId,
    );
    return;
  }
  const publicMatch = path.match(/^\/api\/v1\/task-packs\/([0-9a-f-]{36})$/i);
  if (method === "GET" && publicMatch) {
    if (!dependencies.authorizePublishedPackRead)
      throw new ApplicationError(
        401,
        "SESSION_INVALID",
        "An active participant session is required.",
      );
    await dependencies.authorizePublishedPackRead(request);
    const pack = await dependencies.taskPacks.getPublic(publicMatch[1]);
    if (!pack) throw new ApplicationError(404, "NOT_FOUND", "The task pack was not found.");
    sendJson(response, 200, successEnvelope(pack, requestId), requestId);
    return;
  }

  const principal = await dependencies.adminAuth.authenticate(
    readCookie(request, ADMIN_COOKIE_NAME),
  );
  if (["POST", "PATCH", "PUT", "DELETE"].includes(method))
    validateOriginForCookieMutation(request, dependencies.config);
  if (method === "DELETE" && path === "/api/v1/admin/sessions/current") {
    await dependencies.adminAuth.logout(principal, requestId);
    response.statusCode = 204;
    response.setHeader("Set-Cookie", clearAdminSessionCookie());
    response.setHeader("X-Request-ID", requestId);
    response.end();
    return;
  }
  if (method === "GET" && path === "/api/v1/admin/task-packs") {
    const statusValue = url.searchParams.get("status");
    if (statusValue && !["draft", "published", "archived"].includes(statusValue))
      throw new ApplicationError(422, "VALIDATION_FAILED", "status is invalid.");
    const search = url.searchParams.get("search")?.trim().slice(0, 80);
    const sortValue = url.searchParams.get("sort") ?? "updated_desc";
    if (sortValue !== "updated_desc" && sortValue !== "name_asc")
      throw new ApplicationError(422, "VALIDATION_FAILED", "sort is invalid.");
    const sort = sortValue;
    const limit = parseLimit(url);
    const fingerprint = `admin:${statusValue ?? ""}:${search ?? ""}:${sort}`;
    const offset = parseCursor(url, fingerprint);
    const rows = await dependencies.taskPacks.listAdmin(
      statusValue as "draft" | "published" | "archived" | undefined,
      search,
      limit + 1,
      offset,
      sort,
    );
    sendJson(
      response,
      200,
      successEnvelope(
        rows.slice(0, limit),
        requestId,
        nextCursor(offset, rows.length, limit, fingerprint),
      ),
      requestId,
    );
    return;
  }
  if (method === "POST" && path === "/api/v1/admin/task-packs") {
    const idempotencyKey = requireIdempotencyKey(request);
    const body = await validatedBody(
      request,
      dependencies.config.maxJsonBodyBytes,
      createPackSchema,
    );
    const pack = await dependencies.taskPacks.create(
      body,
      principal.adminUserId,
      requestId,
      idempotencyKey,
    );
    sendJson(response, 201, successEnvelope(pack, requestId), requestId);
    return;
  }
  const packMatch = path.match(/^\/api\/v1\/admin\/task-packs\/([0-9a-f-]{36})$/i);
  if (method === "GET" && packMatch) {
    const pack = await dependencies.taskPacks.getAdmin(packMatch[1]);
    if (!pack) throw new ApplicationError(404, "NOT_FOUND", "The task pack was not found.");
    sendJson(response, 200, successEnvelope(pack, requestId), requestId);
    return;
  }
  if (method === "PATCH" && packMatch) {
    const idempotencyKey = requireIdempotencyKey(request);
    const body = await validatedBody(
      request,
      dependencies.config.maxJsonBodyBytes,
      updatePackSchema,
    );
    const pack = await dependencies.taskPacks.update(
      packMatch[1],
      body,
      principal.adminUserId,
      requestId,
      idempotencyKey,
    );
    sendJson(response, 200, successEnvelope(pack, requestId), requestId);
    return;
  }
  const actionMatch = path.match(
    /^\/api\/v1\/admin\/task-packs\/([0-9a-f-]{36})\/(publish|archive)$/i,
  );
  if (method === "POST" && actionMatch) {
    const idempotencyKey = requireIdempotencyKey(request);
    const body = await validatedBody(request, dependencies.config.maxJsonBodyBytes, revisionSchema);
    const pack = await dependencies.taskPacks.transition(
      actionMatch[1],
      body.expectedRevision,
      actionMatch[2] === "publish" ? "published" : "archived",
      principal.adminUserId,
      requestId,
      idempotencyKey,
    );
    sendJson(response, 200, successEnvelope(pack, requestId), requestId);
    return;
  }
  throw new ApplicationError(404, "NOT_FOUND", "The requested resource was not found.");
}
