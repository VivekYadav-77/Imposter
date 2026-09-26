import type { IncomingMessage, ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import type { Logger } from "pino";

import type { Database } from "../infrastructure/database/database.js";
import { checkDatabaseReadiness } from "../infrastructure/database/database.js";
import type { AppConfig } from "../infrastructure/configuration/config.js";
import type { Metrics } from "../infrastructure/observability/metrics.js";
import { MemoryRateLimiter } from "../infrastructure/security/rate-limiter.js";
import type { AdminAuthService } from "../modules/admin-auth/service.js";
import type { OAuthIntent, UserAuthService, UserPrincipal } from "../modules/user-auth/service.js";
import { updateProfileSchema } from "../modules/user-auth/schemas.js";
import {
  createPackSchema,
  loginSchema,
  revisionSchema,
  updatePackSchema,
} from "../modules/task-packs/schemas.js";
import type { TaskPackRepository } from "../modules/task-packs/repository.js";
import {
  emptyBodySchema,
  roomCreationSchema,
  roomMembershipSchema,
  roomSettingsSchema,
} from "../modules/rooms/schemas.js";
import type { RoomService } from "../modules/rooms/service.js";
import type { ParticipantPrincipal } from "../modules/rooms/types.js";
import type { GameService } from "../modules/games/service.js";
import {
  callMeetingSchema,
  ejectionVoteSchema,
  killSchema,
  reviewVoteSchema,
  startGameSchema,
} from "../modules/games/schemas.js";
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
  USER_COOKIE_NAME,
  OAUTH_COOKIE_NAME,
  userSessionCookie,
  clearUserSessionCookie,
  oauthTransactionCookie,
  clearOAuthTransactionCookie,
  ADMIN_OAUTH_COOKIE_NAME,
  adminOAuthTransactionCookie,
  clearAdminOAuthTransactionCookie,
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
  userAuth?: UserAuthService;
  authorizePublishedPackRead?: (request: IncomingMessage) => Promise<void>;
}

export type ApiHandler = (request: IncomingMessage, response: ServerResponse) => Promise<boolean>;

export function createApiHandler(dependencies: ApiDependencies): ApiHandler {
  const rateLimiter = new MemoryRateLimiter(
    dependencies.config.httpRateLimitMaxRequests,
    dependencies.config.httpRateLimitWindowSeconds,
  );
  return async (request, response) => {
    const requestId = resolveRequestId(request);
    const startedAt = performance.now();
    applySecurityHeaders(request, response, dependencies.config);

    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    const isOwnedPath =
      path.startsWith("/api/") || path.startsWith("/health/") || path === "/internal/metrics";
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

    if (path.startsWith("/api/")) {
      const clientAddress = trustedClientAddress(request, dependencies.config);
      const limit = rateLimiter.consume(`${clientAddress}:${request.method}:${metricPath(path)}`);
      if (!limit.allowed) {
        response.setHeader("Retry-After", String(limit.retryAfterSeconds));
        dependencies.metrics.increment("http.rate_limited", { path: metricPath(path) });
        sendError(
          response,
          new ApplicationError(429, "RATE_LIMITED", "Too many requests.", {
            retryAfterSeconds: limit.retryAfterSeconds,
          }),
          requestId,
        );
        return true;
      }
    }

    const evidenceObjectMatch = path.match(/^\/api\/v1\/evidence-objects\/([A-Za-z0-9._-]+)$/);
    const rawContentLength = request.headers["content-length"];
    const contentLength = rawContentLength === undefined ? undefined : Number(rawContentLength);
    const maximumRequestBytes = evidenceObjectMatch
      ? dependencies.config.evidenceMaxBytes
      : dependencies.config.maxJsonBodyBytes;
    if (
      contentLength !== undefined &&
      Number.isFinite(contentLength) &&
      contentLength > maximumRequestBytes
    ) {
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
      } else if (request.method === "GET" && path === "/internal/metrics") {
        if (!validMetricsCredential(request, dependencies.config.metricsBearerToken))
          throw new ApplicationError(404, "NOT_FOUND", "The requested resource was not found.");
        const payload = dependencies.metrics.renderPrometheus();
        response.statusCode = 200;
        response.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
        response.setHeader("Content-Length", Buffer.byteLength(payload));
        response.setHeader("X-Request-ID", requestId);
        response.end(payload);
      } else if (request.method === "GET" && path === "/api/v1") {
        sendJson(response, 200, successEnvelope({ version: "v1" }, requestId), requestId);
      } else if (
        request.method === "GET" &&
        path === "/api/openapi.json" &&
        dependencies.config.exposeApiDocs
      ) {
        sendJson(response, 200, openApiDocument, requestId);
      } else if (evidenceObjectMatch && dependencies.evidence) {
        if (request.method === "PUT") {
          const contentType = String(request.headers["content-type"] ?? "").split(";")[0];
          await dependencies.evidence.localUploadCapability(
            evidenceObjectMatch[1],
            request,
            contentType,
            contentLength,
          );
          response.statusCode = 204;
          response.setHeader("X-Request-ID", requestId);
          response.end();
        } else if (request.method === "GET") {
          const object = await dependencies.evidence.localCapability(evidenceObjectMatch[1]);
          if (!object.bytes)
            throw new ApplicationError(404, "NOT_FOUND", "The requested resource was not found.");
          response.statusCode = 200;
          response.setHeader("Content-Type", object.contentType ?? "application/octet-stream");
          response.setHeader("Content-Length", object.bytes.byteLength);
          response.setHeader("X-Request-ID", requestId);
          response.end(Buffer.from(object.bytes));
        } else throw new ApplicationError(405, "METHOD_NOT_ALLOWED", "That method is not allowed.");
      } else if (
        dependencies.adminAuth &&
        dependencies.taskPacks &&
        (path === "/api/v1/admin/auth/google/start" ||
          (path === "/api/v1/auth/google/callback" &&
            Boolean(readCookie(request, ADMIN_OAUTH_COOKIE_NAME))))
      ) {
        await handlePhaseTwoRoute(request, response, path, requestId, {
          ...dependencies,
          adminAuth: dependencies.adminAuth,
          taskPacks: dependencies.taskPacks,
        });
      } else if (
        dependencies.userAuth &&
        dependencies.rooms &&
        (path.startsWith("/api/v1/auth/google/") ||
          path === "/api/v1/account-sessions/current" ||
          path === "/api/v1/me" ||
          path.startsWith("/api/v1/me/"))
      ) {
        await handleUserRoute(
          request,
          response,
          path,
          requestId,
          dependencies.userAuth,
          dependencies.rooms,
          dependencies.config,
        );
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
          dependencies.userAuth,
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
      if (error instanceof ApplicationError && [429, 503].includes(error.status)) {
        const retryAfter = error.details?.retryAfterSeconds;
        if (typeof retryAfter === "number") response.setHeader("Retry-After", String(retryAfter));
      }
      if (!(error instanceof ApplicationError)) {
        dependencies.logger.error({ err: error, requestId }, "Unhandled API error");
      }
      sendError(response, error, requestId);
    } finally {
      const durationMs = performance.now() - startedAt;
      const normalizedPath = metricPath(path);
      dependencies.metrics.increment("http.requests", {
        method: request.method ?? "UNKNOWN",
        path: normalizedPath,
        status: String(response.statusCode),
      });
      dependencies.metrics.observe("http.request.duration_ms", durationMs, {
        path: normalizedPath,
      });
      dependencies.logger.info(
        {
          requestId,
          method: request.method,
          path: normalizedPath,
          status: response.statusCode,
          durationMs,
        },
        "HTTP request completed",
      );
    }
    return true;
  };
}

function validMetricsCredential(request: IncomingMessage, expected: string | undefined): boolean {
  const supplied = bearerCredential(request);
  if (!expected || !supplied) return false;
  const actualBytes = Buffer.from(supplied);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function metricPath(path: string): string {
  if (/^\/api\/v1\/evidence-objects\/[A-Za-z0-9._-]+$/.test(path))
    return "/api/v1/evidence-objects/:capability";
  return path.replace(
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/gi,
    "/:id",
  );
}

function trustedClientAddress(request: IncomingMessage, config: AppConfig): string {
  if (config.trustProxy) {
    const forwarded = request.headers["x-forwarded-for"];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  return request.socket.remoteAddress ?? "unknown";
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
    path === "/api/v1/games/current/kills" ||
    path === "/api/v1/games/current/meetings" ||
    path === "/api/v1/meetings/current" ||
    /^\/api\/v1\/task-assignments\/[0-9a-f-]+\/(upload-intents|submissions)$/i.test(path) ||
    /^\/api\/v1\/submissions\/[0-9a-f-]+\/flags$/i.test(path) ||
    /^\/api\/v1\/evidence-review-items\/[0-9a-f-]+\/vote$/i.test(path) ||
    /^\/api\/v1\/meetings\/[0-9a-f-]+\/ejection-vote$/i.test(path)
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
  userAuth?: UserAuthService,
): Promise<void> {
  const method = request.method ?? "GET";
  const publicScope = `public:${trustedClientAddress(request, config)}`;
  if (method === "POST" && path === "/api/v1/rooms") {
    const key = requireIdempotencyKey(request);
    const body = await validatedBody(request, config.maxJsonBodyBytes, roomCreationSchema);
    const issued = await rooms.createRoom(body, key, publicScope);
    const account = userAuth
      ? await userAuth.authenticate(readCookie(request, USER_COOKIE_NAME))
      : null;
    if (account) await userAuth!.claimParticipant(account, issued.participant.participantId);
    sendIssuedSession(request, response, 201, issued, requestId, config);
    return;
  }
  const joinOptionsMatch = path.match(/^\/api\/v1\/rooms\/([A-Za-z0-9]{6})\/join-options$/);
  if (method === "GET" && joinOptionsMatch) {
    response.setHeader("Cache-Control", "no-store");
    sendJson(
      response,
      200,
      successEnvelope(
        await rooms.joinOptions(
          joinOptionsMatch[1],
          `${publicScope}:${joinOptionsMatch[1].toUpperCase()}`,
        ),
        requestId,
      ),
      requestId,
    );
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
    const account = userAuth
      ? await userAuth.authenticate(readCookie(request, USER_COOKIE_NAME))
      : null;
    if (account) await userAuth!.claimParticipant(account, issued.participant.participantId);
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
  if (method === "POST" && path === "/api/v1/rooms/current/replay") {
    const key = requireIdempotencyKey(request);
    await validatedBody(request, config.maxJsonBodyBytes, emptyBodySchema);
    sendJson(
      response,
      200,
      successEnvelope(await rooms.replayRoom(principal, key), requestId),
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

function userRequestMeta(request: IncomingMessage, config: AppConfig) {
  return {
    ip: trustedClientAddress(request, config),
    userAgent: String(request.headers["user-agent"] ?? ""),
  };
}

async function requireUser(
  request: IncomingMessage,
  users: UserAuthService,
): Promise<UserPrincipal> {
  const principal = await users.authenticate(readCookie(request, USER_COOKIE_NAME));
  if (!principal) throw new ApplicationError(401, "USER_SESSION_INVALID", "Sign in to continue.");
  return principal;
}

async function handleUserRoute(
  request: IncomingMessage,
  response: ServerResponse,
  path: string,
  requestId: string,
  users: UserAuthService,
  rooms: RoomService,
  config: AppConfig,
): Promise<void> {
  const method = request.method ?? "GET";
  if (["POST", "PATCH", "PUT", "DELETE"].includes(method) && readCookie(request, USER_COOKIE_NAME))
    validateOriginForCookieMutation(request, config);
  if (method === "GET" && path === "/api/v1/auth/google/start") {
    const url = new URL(request.url ?? path, "http://localhost");
    const intentValue = url.searchParams.get("intent") ?? "login";
    const intents: OAuthIntent[] = ["login", "play", "post_game", "delete"];
    if (!intents.includes(intentValue as OAuthIntent))
      throw new ApplicationError(422, "VALIDATION_FAILED", "Choose a valid sign-in intent.");
    const intent = intentValue as OAuthIntent;
    const participant = await participantPrincipalOptional(request, rooms);
    const currentUser = await users.authenticate(readCookie(request, USER_COOKIE_NAME));
    const transaction = await users.beginGoogleAuth(
      intent,
      participant?.participantId ?? null,
      currentUser,
    );
    response.statusCode = 302;
    response.setHeader("Location", transaction.authorizationUrl);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Set-Cookie", oauthTransactionCookie(transaction.state));
    response.setHeader("X-Request-ID", requestId);
    response.end();
    return;
  }
  if (method === "GET" && path === "/api/v1/auth/google/callback") {
    const url = new URL(request.url ?? path, "http://localhost");
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const providerError = url.searchParams.get("error");
    if (providerError || !state || !code) {
      const reason = providerError === "access_denied" ? "cancelled" : "invalid_response";
      response.statusCode = 302;
      response.setHeader("Location", `/login?authError=${reason}`);
      response.setHeader("Set-Cookie", clearOAuthTransactionCookie());
      response.setHeader("X-Request-ID", requestId);
      response.end();
      return;
    }
    try {
      const completed = await users.completeGoogleAuth({
        state,
        cookieState: readCookie(request, OAUTH_COOKIE_NAME),
        code,
        meta: userRequestMeta(request, config),
      });
      if (completed.session && completed.participantId)
        await users.claimParticipant(
          { userId: completed.user.id, sessionId: completed.session.sessionId },
          completed.participantId,
        );
      const cookies = [clearOAuthTransactionCookie()];
      if (completed.session)
        cookies.unshift(userSessionCookie(completed.session.token, config.userSessionTtlSeconds));
      response.statusCode = 302;
      response.setHeader("Location", completed.returnTo);
      response.setHeader("Set-Cookie", cookies);
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Request-ID", requestId);
      response.end();
    } catch (error) {
      const code = error instanceof ApplicationError ? error.code : "GOOGLE_AUTH_FAILED";
      response.statusCode = 302;
      response.setHeader("Location", `/login?authError=${encodeURIComponent(code.toLowerCase())}`);
      response.setHeader("Set-Cookie", clearOAuthTransactionCookie());
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Request-ID", requestId);
      response.end();
    }
    return;
  }
  const principal = await requireUser(request, users);
  if (method === "GET" && path === "/api/v1/me") {
    sendJson(response, 200, successEnvelope(await users.profile(principal), requestId), requestId);
    return;
  }
  if (method === "PATCH" && path === "/api/v1/me") {
    const body = await validatedBody(request, config.maxJsonBodyBytes, updateProfileSchema);
    sendJson(
      response,
      200,
      successEnvelope(await users.updateProfile(principal, body), requestId),
      requestId,
    );
    return;
  }
  if (method === "DELETE" && path === "/api/v1/me") {
    await validatedBody(request, config.maxJsonBodyBytes, emptyBodySchema);
    await users.deleteAccount(principal);
    response.setHeader("Set-Cookie", clearUserSessionCookie());
    response.statusCode = 204;
    response.end();
    return;
  }
  if (method === "GET" && path === "/api/v1/me/dashboard") {
    sendJson(
      response,
      200,
      successEnvelope(await users.dashboard(principal), requestId),
      requestId,
    );
    return;
  }
  if (method === "GET" && path === "/api/v1/me/games") {
    const url = new URL(request.url ?? path, "http://localhost");
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));
    sendJson(
      response,
      200,
      successEnvelope(
        await users.history(principal, limit, url.searchParams.get("cursor") ?? undefined),
        requestId,
      ),
      requestId,
    );
    return;
  }
  const game = path.match(/^\/api\/v1\/me\/games\/([0-9a-f-]{36})$/i);
  if (method === "GET" && game) {
    sendJson(
      response,
      200,
      successEnvelope(await users.gameDetail(principal, game[1]), requestId),
      requestId,
    );
    return;
  }
  if (method === "GET" && path === "/api/v1/me/sessions") {
    sendJson(response, 200, successEnvelope(await users.sessions(principal), requestId), requestId);
    return;
  }
  if (method === "DELETE" && path === "/api/v1/account-sessions/current") {
    await users.revokeSession(principal, principal.sessionId);
    response.setHeader("Set-Cookie", clearUserSessionCookie());
    response.statusCode = 204;
    response.end();
    return;
  }
  if (method === "DELETE" && path === "/api/v1/me/sessions/others") {
    await users.revokeOthers(principal);
    response.statusCode = 204;
    response.end();
    return;
  }
  const session = path.match(/^\/api\/v1\/me\/sessions\/([0-9a-f-]{36})$/i);
  if (method === "DELETE" && session) {
    await users.revokeSession(principal, session[1]);
    if (session[1] === principal.sessionId)
      response.setHeader("Set-Cookie", clearUserSessionCookie());
    response.statusCode = 204;
    response.end();
    return;
  }
  const rejoin = path.match(/^\/api\/v1\/me\/participations\/([0-9a-f-]{36})\/rejoin$/i);
  if (method === "POST" && rejoin) {
    const key = requireIdempotencyKey(request);
    await validatedBody(request, config.maxJsonBodyBytes, emptyBodySchema);
    const issued = await rooms.rejoinForUser(principal.userId, rejoin[1], key);
    const maxAge = Math.max(
      0,
      Math.floor((Date.parse(issued.sessionExpiresAt) - Date.now()) / 1000),
    );
    response.setHeader("Set-Cookie", participantSessionCookie(issued.sessionToken, maxAge));
    sendJson(
      response,
      200,
      successEnvelope({ room: issued.room, sessionExpiresAt: issued.sessionExpiresAt }, requestId),
      requestId,
    );
    return;
  }
  throw new ApplicationError(404, "NOT_FOUND", "The requested resource was not found.");
}

async function participantPrincipalOptional(
  request: IncomingMessage,
  rooms: RoomService,
): Promise<ParticipantPrincipal | null> {
  const credential = participantCredential(request);
  return credential ? rooms.authenticate(credential) : null;
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
  if (method === "POST" && path === "/api/v1/games/current/kills") {
    const key = requireIdempotencyKey(request);
    const body = await validatedBody(request, config.maxJsonBodyBytes, killSchema);
    sendJson(
      response,
      201,
      successEnvelope(await games.kill(principal, body, key), requestId),
      requestId,
    );
    return;
  }
  if (method === "POST" && path === "/api/v1/games/current/meetings") {
    const key = requireIdempotencyKey(request);
    const body = await validatedBody(request, config.maxJsonBodyBytes, callMeetingSchema);
    sendJson(
      response,
      201,
      successEnvelope(await games.callMeeting(principal, body, key), requestId),
      requestId,
    );
    return;
  }
  if (method === "GET" && path === "/api/v1/meetings/current") {
    sendJson(
      response,
      200,
      successEnvelope(await games.currentMeeting(principal), requestId),
      requestId,
    );
    return;
  }
  const reviewVoteMatch = path.match(/^\/api\/v1\/evidence-review-items\/([0-9a-f-]+)\/vote$/i);
  if (method === "PUT" && reviewVoteMatch) {
    const key = requireIdempotencyKey(request);
    const body = await validatedBody(request, config.maxJsonBodyBytes, reviewVoteSchema);
    sendJson(
      response,
      200,
      successEnvelope(await games.reviewVote(principal, reviewVoteMatch[1], body, key), requestId),
      requestId,
    );
    return;
  }
  const ejectionVoteMatch = path.match(/^\/api\/v1\/meetings\/([0-9a-f-]+)\/ejection-vote$/i);
  if (method === "PUT" && ejectionVoteMatch) {
    const key = requireIdempotencyKey(request);
    const body = await validatedBody(request, config.maxJsonBodyBytes, ejectionVoteSchema);
    sendJson(
      response,
      200,
      successEnvelope(
        await games.ejectionVote(principal, ejectionVoteMatch[1], body, key),
        requestId,
      ),
      requestId,
    );
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
  if (method === "GET" && path === "/api/v1/admin/auth/google/start") {
    const transaction = await dependencies.adminAuth.beginGoogleLogin();
    response.statusCode = 302;
    response.setHeader("Location", transaction.authorizationUrl);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Set-Cookie", adminOAuthTransactionCookie(transaction.state));
    response.setHeader("X-Request-ID", requestId);
    response.end();
    return;
  }
  if (method === "GET" && path === "/api/v1/auth/google/callback") {
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const providerError = url.searchParams.get("error");
    if (providerError || !state || !code) {
      response.statusCode = 302;
      response.setHeader("Location", "/admin/login?authError=cancelled");
      response.setHeader("Set-Cookie", clearAdminOAuthTransactionCookie());
      response.end();
      return;
    }
    try {
      const session = await dependencies.adminAuth.completeGoogleLogin({
        state,
        cookieState: readCookie(request, ADMIN_OAUTH_COOKIE_NAME),
        code,
        ip: trustedClientAddress(request, dependencies.config),
        requestId,
      });
      response.statusCode = 302;
      response.setHeader("Location", "/admin/task-packs");
      response.setHeader("Set-Cookie", [
        adminSessionCookie(session.token, session.maxAgeSeconds),
        clearAdminOAuthTransactionCookie(),
      ]);
      response.setHeader("Cache-Control", "no-store");
      response.end();
    } catch (error) {
      const code =
        error instanceof ApplicationError ? error.code.toLowerCase() : "google_auth_failed";
      response.statusCode = 302;
      response.setHeader("Location", `/admin/login?authError=${encodeURIComponent(code)}`);
      response.setHeader("Set-Cookie", clearAdminOAuthTransactionCookie());
      response.setHeader("Cache-Control", "no-store");
      response.end();
    }
    return;
  }
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
  if (method === "GET" && path === "/api/v1/admin/users") {
    sendJson(
      response,
      200,
      successEnvelope(await dependencies.adminAuth.listUserAccounts(), requestId),
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
  if (method === "DELETE" && packMatch) {
    const idempotencyKey = requireIdempotencyKey(request);
    const body = await validatedBody(request, dependencies.config.maxJsonBodyBytes, revisionSchema);
    const result = await dependencies.taskPacks.delete(
      packMatch[1],
      body.expectedRevision,
      principal.adminUserId,
      requestId,
      idempotencyKey,
    );
    sendJson(response, 200, successEnvelope(result, requestId), requestId);
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
