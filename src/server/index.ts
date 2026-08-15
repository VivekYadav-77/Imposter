import { createServer } from "node:http";
import next from "next";

import { createApiHandler } from "../api/router.js";
import { loadConfig } from "../infrastructure/configuration/config.js";
import { closeDatabase, createDatabase } from "../infrastructure/database/database.js";
import { createLogger } from "../infrastructure/observability/logger.js";
import { InMemoryMetrics } from "../infrastructure/observability/metrics.js";
import { RejectingParticipantSessionAuthenticator } from "../realtime/authentication.js";
import { attachRealtimeServer } from "../realtime/server.js";
import { ShutdownManager } from "./shutdown.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = createLogger(config);
  const database = createDatabase(config);
  const metrics = new InMemoryMetrics();
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
  const apiHandler = createApiHandler({ config, database: database.db, logger, metrics });
  const httpServer = createServer((request, response) => {
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
  const realtime = attachRealtimeServer(
    httpServer,
    config,
    logger,
    new RejectingParticipantSessionAuthenticator(),
  );
  const shutdown = new ShutdownManager(logger, config.shutdownTimeoutMs, [
    () => new Promise<void>((resolve) => realtime.close(() => resolve())),
    () =>
      new Promise<void>((resolve, reject) =>
        httpServer.close((error) => (error ? reject(error) : resolve())),
      ),
    () => closeDatabase(database),
  ]);

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
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
