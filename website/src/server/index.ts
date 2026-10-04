import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { loadEnvFile } from "node:process";
import next from "next";

import { createApiHandler } from "../api/router.js";
import { contentSecurityPolicy } from "../api/security-headers.js";
import { loadConfig } from "../infrastructure/configuration/config.js";
import {
  checkDatabaseReadiness,
  closeDatabase,
  createDatabase,
} from "../infrastructure/database/database.js";
import { createLogger } from "../infrastructure/observability/logger.js";
import { InMemoryMetrics } from "../infrastructure/observability/metrics.js";
import { PostgresAdminAuthRepository } from "../modules/admin-auth/repository.js";
import { AdminAuthService } from "../modules/admin-auth/service.js";
import { UserAuthService } from "../modules/user-auth/service.js";
import { createGoogleIdentityProvider } from "../modules/user-auth/google-oauth.js";
import { MemoryLoginThrottle } from "../modules/admin-auth/throttle.js";
import { TaskPackRepository } from "../modules/task-packs/repository.js";
import { RoomService } from "../modules/rooms/service.js";
import { GameService } from "../modules/games/service.js";
import { EvidenceService } from "../modules/evidence/service.js";
import { LocalObjectStorage } from "../infrastructure/object-storage/storage.js";
import { attachRealtimeServer } from "../realtime/server.js";
import { PARTICIPANT_COOKIE_NAME, readCookie } from "../shared/security/cookies.js";
import { ApplicationError } from "../shared/errors/application-error.js";
import { ShutdownManager } from "./shutdown.js";

try {
  loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const database = createDatabase(config);
  const metrics = new InMemoryMetrics();
  let acceptingTraffic = true;
  const nextApp = next({
    dev: config.appEnv === "development",
    hostname: config.host,
    port: config.port,
  });

  try {
    await nextApp.prepare();
  } catch (error) {
    logger.fatal({ err: error }, "Application startup failed");
    await closeDatabase(database);
    throw error;
  }

  const nextHandler = nextApp.getRequestHandler();
  const adminRepository = new PostgresAdminAuthRepository(database.db);
  const adminAuth = new AdminAuthService(
    adminRepository,
    new MemoryLoginThrottle(config.adminLoginMaxAttempts, config.adminLoginWindowSeconds),
    config.adminSessionTokenPepper,
    config.adminSessionTtlSeconds,
    createGoogleIdentityProvider(config),
  );
  const taskPacks = new TaskPackRepository(database.db);
  const rooms = new RoomService(database.db, config);
  const userAuth = new UserAuthService(database.db, config);
  const games = new GameService(database.db);
  const evidence = new EvidenceService(
    database.db,
    config,
    new LocalObjectStorage(config),
    games.events,
  );
  games.events.on("game.changed", ({ roomId }: { roomId: string }) => {
    rooms.events.roomChanged(roomId);
  });
  const apiHandler = createApiHandler({
    config,
    database: database.db,
    logger,
    metrics,
    adminAuth,
    taskPacks,
    rooms,
    userAuth,
    games,
    evidence,
    readinessCheck: async () => {
      if (!acceptingTraffic) throw new Error("Application is draining");
      await checkDatabaseReadiness(database.db, config.databaseReadyTimeoutMs);
    },
    authorizePublishedPackRead: async (request) => {
      const header = request.headers.authorization;
      const bearer = header?.startsWith("Bearer ") ? header.slice(7).trim() : null;
      const token = bearer || readCookie(request, PARTICIPANT_COOKIE_NAME);
      if (!token || !(await rooms.authenticate(token)))
        throw new ApplicationError(
          401,
          "SESSION_INVALID",
          "An active participant session is required.",
        );
    },
  });
  const httpServer = createServer((request, response) => {
    const nonce = randomBytes(16).toString("base64");
    request.headers["x-nonce"] = nonce;
    request.headers["content-security-policy"] = contentSecurityPolicy(config, nonce);
    void apiHandler(request, response)
      .then((handled) => {
        if (!handled) return nextHandler(request, response);
      })
      .catch((error: unknown) => {
        logger.error({ err: error }, "HTTP dispatch failed");
        if (!response.headersSent) {
          response.statusCode = 500;
          response.end();
        }
      });
  });
  httpServer.requestTimeout = config.httpRequestTimeoutMs;
  httpServer.headersTimeout = config.httpHeadersTimeoutMs;
  httpServer.keepAliveTimeout = config.httpKeepAliveTimeoutMs;
  const realtime = attachRealtimeServer(httpServer, config, logger, rooms, games, metrics);
  const updateRuntimeMetrics = () => {
    metrics.set("database.pool.total", database.pool.totalCount);
    metrics.set("database.pool.idle", database.pool.idleCount);
    metrics.set("database.pool.waiting", database.pool.waitingCount);
    metrics.set("process.uptime_seconds", process.uptime());
  };
  const metricsWorker = setInterval(updateRuntimeMetrics, 5000);
  metricsWorker.unref();
  updateRuntimeMetrics();
  const maintenance = setInterval(() => {
    void rooms
      .runMaintenance()
      .then(() => metrics.increment("worker.room_maintenance.success"))
      .catch((error: unknown) => logger.error({ err: error }, "Room maintenance failed"));
  }, config.roomMaintenanceIntervalMs);
  maintenance.unref();
  const evidenceWorkerId = `evidence-${process.pid}`;
  const evidenceWorkerStop = new AbortController();
  const waitForEvidenceWork = () =>
    new Promise<void>((resolve) => {
      if (evidenceWorkerStop.signal.aborted) return resolve();
      const finish = () => {
        clearTimeout(timer);
        evidenceWorkerStop.signal.removeEventListener("abort", finish);
        resolve();
      };
      const timer = setTimeout(finish, config.evidenceWorkerIntervalMs);
      timer.unref();
      evidenceWorkerStop.signal.addEventListener("abort", finish, { once: true });
    });
  let lastRetentionSweep = 0;
  const evidenceWorkers = Array.from({ length: config.evidenceProcessingConcurrency }, (_, slot) =>
    (async () => {
      while (!evidenceWorkerStop.signal.aborted) {
        try {
          if (slot === 0 && Date.now() - lastRetentionSweep >= config.evidenceWorkerIntervalMs) {
            lastRetentionSweep = Date.now();
            await evidence.scheduleTerminalRetention();
          }
          const worked = await evidence.runNextJob(`${evidenceWorkerId}-${slot}`);
          metrics.increment("worker.evidence.tick", {
            outcome: worked ? "processed" : "idle",
          });
          if (!worked) await waitForEvidenceWork();
        } catch (error) {
          metrics.increment("worker.evidence.failures");
          logger.error({ err: error, workerSlot: slot }, "Evidence worker failed");
          await waitForEvidenceWork();
        }
      }
    })(),
  );
  const meetingWorker = setInterval(() => {
    void games
      .runDueTransitions()
      .then((count) => {
        metrics.observe("worker.deadline.transitions", count);
      })
      .catch((error: unknown) => {
        metrics.increment("worker.deadline.failures");
        logger.error({ err: error }, "Meeting deadline worker failed");
      });
  }, 1000);
  meetingWorker.unref();
  void rooms
    .runMaintenance()
    .catch((error: unknown) => logger.warn({ err: error }, "Initial room maintenance failed"));
  const shutdown = new ShutdownManager(logger, config.shutdownTimeoutMs, [
    async () => {
      clearInterval(maintenance);
      evidenceWorkerStop.abort();
      clearInterval(meetingWorker);
      clearInterval(metricsWorker);
      await Promise.all(evidenceWorkers);
      await closeDatabase(database);
    },
    () => new Promise<void>((resolve) => realtime.close(() => resolve())),
    () =>
      new Promise<void>((resolve, reject) =>
        httpServer.close((error) => (error ? reject(error) : resolve())),
      ),
  ]);

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      acceptingTraffic = false;
      void shutdown
        .shutdown(signal)
        .then(() => process.exit(0))
        .catch((error: unknown) => {
          logger.fatal({ err: error }, "Graceful shutdown failed");
          process.exit(1);
        });
    });
  }

  httpServer.listen(config.port, config.host, () => {
    logger.info({ host: config.host, port: config.port }, "Application listening");
  });
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `Fatal startup error: ${error instanceof Error ? error.message : "unknown"}\n`,
  );
  process.exitCode = 1;
});
