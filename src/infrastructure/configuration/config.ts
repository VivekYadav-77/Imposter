import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const optionalNonEmptyString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const configSchema = z
  .object({
    APP_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().min(1).default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().url().startsWith("postgresql://"),
    DATABASE_SSL: booleanString,
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
    DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(100).max(30000).default(5000),
    DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
    DATABASE_STATEMENT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
    DATABASE_READY_TIMEOUT_MS: z.coerce.number().int().min(100).max(10000).default(1500),
    SERVICE_VERSION: z.string().trim().min(1).max(128).default("development"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    CORS_ALLOWED_ORIGINS: z.string().default(""),
    CSP_IMAGE_SOURCES: z.string().default(""),
    MAX_JSON_BODY_BYTES: z.coerce.number().int().min(1024).max(1048576).default(65536),
    EXPOSE_API_DOCS: booleanString,
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(10000),
    HTTP_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
    HTTP_HEADERS_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(15000),
    HTTP_KEEP_ALIVE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(5000),
    HTTP_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().min(1).max(3600).default(60),
    HTTP_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().min(10).max(10000).default(180),
    TRUST_PROXY: booleanString,
    METRICS_BEARER_TOKEN: z.string().min(32).optional(),
    ADMIN_SESSION_TOKEN_PEPPER: z.string().min(32).default("development-only-admin-token-pepper"),
    ADMIN_SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(86400).default(28800),
    ADMIN_LOGIN_WINDOW_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    ADMIN_LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(2).max(20).default(5),
    PARTICIPANT_SESSION_TOKEN_PEPPER: z
      .string()
      .min(32)
      .default("development-only-participant-token-pepper"),
    PARTICIPANT_SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(86400).default(7200),
    USER_SESSION_TOKEN_PEPPER: z.string().min(32).default("development-only-user-session-pepper"),
    USER_SESSION_TTL_SECONDS: z.coerce.number().int().min(3600).max(31536000).default(2592000),
    GOOGLE_OAUTH_CLIENT_ID: optionalNonEmptyString,
    GOOGLE_OAUTH_CLIENT_SECRET: optionalNonEmptyString,
    GOOGLE_OAUTH_REDIRECT_URI: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
      z.string().url().optional(),
    ),
    ROOM_LOBBY_TTL_SECONDS: z.coerce.number().int().min(300).max(86400).default(7200),
    ROOM_CODE_COOLDOWN_SECONDS: z.coerce.number().int().min(0).max(604800).default(86400),
    HOST_DISCONNECT_GRACE_SECONDS: z.coerce.number().int().min(5).max(600).default(30),
    ROOM_MAINTENANCE_INTERVAL_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
    EVIDENCE_LOCAL_DIRECTORY: z.string().min(1).default(".data/evidence"),
    EVIDENCE_UPLOAD_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
    EVIDENCE_VIEW_TTL_SECONDS: z.coerce.number().int().min(30).max(300).default(60),
    EVIDENCE_MAX_BYTES: z.coerce.number().int().min(1024).max(5242880).default(5242880),
    EVIDENCE_GAME_MAX_BYTES: z.coerce
      .number()
      .int()
      .min(5242880)
      .max(1073741824)
      .default(251658240),
    EVIDENCE_MAX_PIXELS: z.coerce.number().int().min(1000000).max(40000000).default(20000000),
    EVIDENCE_RETENTION_SECONDS: z.coerce.number().int().min(3600).max(86400).default(86400),
    EVIDENCE_ORPHAN_TTL_SECONDS: z.coerce.number().int().min(300).max(86400).default(3600),
    EVIDENCE_WORKER_INTERVAL_MS: z.coerce.number().int().min(1000).max(60000).default(5000),
    EVIDENCE_UPLOAD_MAX_CONCURRENT: z.coerce.number().int().min(1).max(64).default(8),
    EVIDENCE_UPLOAD_MAX_QUEUED: z.coerce.number().int().min(0).max(1000).default(64),
    EVIDENCE_UPLOAD_QUEUE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(15000),
    EVIDENCE_PROCESSING_CONCURRENCY: z.coerce.number().int().min(1).max(4).default(2),
    REALTIME_PING_INTERVAL_MS: z.coerce.number().int().min(5000).max(60000).default(25000),
    REALTIME_PING_TIMEOUT_MS: z.coerce.number().int().min(5000).max(60000).default(20000),
    REALTIME_DISCONNECT_GRACE_MS: z.coerce.number().int().min(0).max(60000).default(5000),
  })
  .superRefine((values, context) => {
    if (values.HTTP_HEADERS_TIMEOUT_MS > values.HTTP_REQUEST_TIMEOUT_MS) {
      context.addIssue({
        code: "custom",
        path: ["HTTP_HEADERS_TIMEOUT_MS"],
        message: "must not exceed HTTP_REQUEST_TIMEOUT_MS",
      });
    }
    if (values.APP_ENV !== "production") return;

    const productionIssues: Array<[string, boolean]> = [
      [
        "ADMIN_SESSION_TOKEN_PEPPER",
        values.ADMIN_SESSION_TOKEN_PEPPER.includes("development-only"),
      ],
      [
        "PARTICIPANT_SESSION_TOKEN_PEPPER",
        values.PARTICIPANT_SESSION_TOKEN_PEPPER.includes("development-only"),
      ],
      ["USER_SESSION_TOKEN_PEPPER", values.USER_SESSION_TOKEN_PEPPER.includes("development-only")],
      ["METRICS_BEARER_TOKEN", !values.METRICS_BEARER_TOKEN],
      ["GOOGLE_OAUTH_CLIENT_ID", !values.GOOGLE_OAUTH_CLIENT_ID],
      ["GOOGLE_OAUTH_CLIENT_SECRET", !values.GOOGLE_OAUTH_CLIENT_SECRET],
      ["GOOGLE_OAUTH_REDIRECT_URI", !values.GOOGLE_OAUTH_REDIRECT_URI],
      ["SERVICE_VERSION", values.SERVICE_VERSION === "development"],
      ["CORS_ALLOWED_ORIGINS", values.CORS_ALLOWED_ORIGINS.trim().length === 0],
      ["CSP_IMAGE_SOURCES", values.CSP_IMAGE_SOURCES.trim().length === 0],
      ["TRUST_PROXY", !values.TRUST_PROXY],
    ];
    for (const [path, invalid] of productionIssues) {
      if (invalid)
        context.addIssue({ code: "custom", path: [path], message: "must be set for production" });
    }
    if (values.ADMIN_SESSION_TOKEN_PEPPER === values.PARTICIPANT_SESSION_TOKEN_PEPPER) {
      context.addIssue({
        code: "custom",
        path: ["PARTICIPANT_SESSION_TOKEN_PEPPER"],
        message: "must be distinct from ADMIN_SESSION_TOKEN_PEPPER",
      });
    }
    if (
      [values.ADMIN_SESSION_TOKEN_PEPPER, values.PARTICIPANT_SESSION_TOKEN_PEPPER].includes(
        values.USER_SESSION_TOKEN_PEPPER,
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["USER_SESSION_TOKEN_PEPPER"],
        message: "must be distinct from other session peppers",
      });
    }
    for (const origin of values.CORS_ALLOWED_ORIGINS.split(",").filter(Boolean)) {
      try {
        if (new URL(origin.trim()).protocol !== "https:") throw new Error("not HTTPS");
      } catch {
        context.addIssue({
          code: "custom",
          path: ["CORS_ALLOWED_ORIGINS"],
          message: "production origins must be absolute HTTPS URLs",
        });
      }
    }
    for (const source of values.CSP_IMAGE_SOURCES.split(",").filter(Boolean)) {
      try {
        if (new URL(source.trim()).protocol !== "https:") throw new Error("not HTTPS");
      } catch {
        context.addIssue({
          code: "custom",
          path: ["CSP_IMAGE_SOURCES"],
          message: "production image sources must be absolute HTTPS origins",
        });
      }
    }
    if (
      values.GOOGLE_OAUTH_REDIRECT_URI &&
      new URL(values.GOOGLE_OAUTH_REDIRECT_URI).protocol !== "https:"
    ) {
      context.addIssue({
        code: "custom",
        path: ["GOOGLE_OAUTH_REDIRECT_URI"],
        message: "must use HTTPS in production",
      });
    }
  })
  .transform((values) => ({
    appEnv: values.APP_ENV,
    host: values.HOST,
    port: values.PORT,
    databaseUrl: values.DATABASE_URL,
    databaseSsl: values.DATABASE_SSL,
    databasePoolMax: values.DATABASE_POOL_MAX,
    databaseConnectionTimeoutMs: values.DATABASE_CONNECTION_TIMEOUT_MS,
    databaseIdleTimeoutMs: values.DATABASE_IDLE_TIMEOUT_MS,
    databaseStatementTimeoutMs: values.DATABASE_STATEMENT_TIMEOUT_MS,
    databaseReadyTimeoutMs: values.DATABASE_READY_TIMEOUT_MS,
    serviceVersion: values.SERVICE_VERSION,
    logLevel: values.LOG_LEVEL,
    corsAllowedOrigins: values.CORS_ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    cspImageSources: values.CSP_IMAGE_SOURCES.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    maxJsonBodyBytes: values.MAX_JSON_BODY_BYTES,
    exposeApiDocs: values.EXPOSE_API_DOCS,
    shutdownTimeoutMs: values.SHUTDOWN_TIMEOUT_MS,
    httpRequestTimeoutMs: values.HTTP_REQUEST_TIMEOUT_MS,
    httpHeadersTimeoutMs: values.HTTP_HEADERS_TIMEOUT_MS,
    httpKeepAliveTimeoutMs: values.HTTP_KEEP_ALIVE_TIMEOUT_MS,
    httpRateLimitWindowSeconds: values.HTTP_RATE_LIMIT_WINDOW_SECONDS,
    httpRateLimitMaxRequests: values.HTTP_RATE_LIMIT_MAX_REQUESTS,
    trustProxy: values.TRUST_PROXY,
    metricsBearerToken: values.METRICS_BEARER_TOKEN,
    adminSessionTokenPepper: values.ADMIN_SESSION_TOKEN_PEPPER,
    adminSessionTtlSeconds: values.ADMIN_SESSION_TTL_SECONDS,
    adminLoginWindowSeconds: values.ADMIN_LOGIN_WINDOW_SECONDS,
    adminLoginMaxAttempts: values.ADMIN_LOGIN_MAX_ATTEMPTS,
    participantSessionTokenPepper: values.PARTICIPANT_SESSION_TOKEN_PEPPER,
    participantSessionTtlSeconds: values.PARTICIPANT_SESSION_TTL_SECONDS,
    userSessionTokenPepper: values.USER_SESSION_TOKEN_PEPPER,
    userSessionTtlSeconds: values.USER_SESSION_TTL_SECONDS,
    googleOAuthClientId: values.GOOGLE_OAUTH_CLIENT_ID,
    googleOAuthClientSecret: values.GOOGLE_OAUTH_CLIENT_SECRET,
    googleOAuthRedirectUri: values.GOOGLE_OAUTH_REDIRECT_URI,
    roomLobbyTtlSeconds: values.ROOM_LOBBY_TTL_SECONDS,
    roomCodeCooldownSeconds: values.ROOM_CODE_COOLDOWN_SECONDS,
    hostDisconnectGraceSeconds: values.HOST_DISCONNECT_GRACE_SECONDS,
    roomMaintenanceIntervalMs: values.ROOM_MAINTENANCE_INTERVAL_MS,
    evidenceLocalDirectory: values.EVIDENCE_LOCAL_DIRECTORY,
    evidenceUploadTtlSeconds: values.EVIDENCE_UPLOAD_TTL_SECONDS,
    evidenceViewTtlSeconds: values.EVIDENCE_VIEW_TTL_SECONDS,
    evidenceMaxBytes: values.EVIDENCE_MAX_BYTES,
    evidenceGameMaxBytes: values.EVIDENCE_GAME_MAX_BYTES,
    evidenceMaxPixels: values.EVIDENCE_MAX_PIXELS,
    evidenceRetentionSeconds: values.EVIDENCE_RETENTION_SECONDS,
    evidenceOrphanTtlSeconds: values.EVIDENCE_ORPHAN_TTL_SECONDS,
    evidenceWorkerIntervalMs: values.EVIDENCE_WORKER_INTERVAL_MS,
    evidenceUploadMaxConcurrent: values.EVIDENCE_UPLOAD_MAX_CONCURRENT,
    evidenceUploadMaxQueued: values.EVIDENCE_UPLOAD_MAX_QUEUED,
    evidenceUploadQueueTimeoutMs: values.EVIDENCE_UPLOAD_QUEUE_TIMEOUT_MS,
    evidenceProcessingConcurrency: values.EVIDENCE_PROCESSING_CONCURRENCY,
    realtimePingIntervalMs: values.REALTIME_PING_INTERVAL_MS,
    realtimePingTimeoutMs: values.REALTIME_PING_TIMEOUT_MS,
    realtimeDisconnectGraceMs: values.REALTIME_DISCONNECT_GRACE_MS,
  }));

export type AppConfig = z.output<typeof configSchema>;

export function loadConfig(
  environment: Record<string, string | undefined> = process.env,
): AppConfig {
  const parsed = configSchema.safeParse(environment);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid application configuration: ${fields}`);
  }
  return parsed.data;
}
