import pino, { type Logger } from "pino";

import type { AppConfig } from "../configuration/config.js";

const redactedPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "request.headers.authorization",
  "request.headers.cookie",
  "password",
  "passwordHash",
  "sessionToken",
  "token",
  "signedUrl",
];

export function createLogger(config: AppConfig): Logger {
  return pino({
    level: config.logLevel,
    base: {
      service: "imposter-game",
      environment: config.appEnv,
      version: config.serviceVersion,
    },
    redact: { paths: redactedPaths, censor: "[REDACTED]" },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
