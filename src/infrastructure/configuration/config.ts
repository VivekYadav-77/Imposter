import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const configSchema = z
  .object({
    APP_ENV: z.enum(["development", "test", "production"]).default("development"),
    HOST: z.string().min(1).default("127.0.0.1"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.string().url().startsWith("postgresql://"),
    DATABASE_SSL: booleanString,
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
    DATABASE_READY_TIMEOUT_MS: z.coerce.number().int().min(100).max(10000).default(1500),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    CORS_ALLOWED_ORIGINS: z.string().default(""),
    MAX_JSON_BODY_BYTES: z.coerce.number().int().min(1024).max(1048576).default(65536),
    EXPOSE_API_DOCS: booleanString,
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(10000),
    ADMIN_SESSION_TOKEN_PEPPER: z.string().min(32).default("development-only-admin-token-pepper"),
    ADMIN_SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(86400).default(28800),
    ADMIN_LOGIN_WINDOW_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
    ADMIN_LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(2).max(20).default(5),
    PARTICIPANT_SESSION_TOKEN_PEPPER: z
      .string()
      .min(32)
      .default("development-only-participant-token-pepper"),
    PARTICIPANT_SESSION_TTL_SECONDS: z.coerce.number().int().min(300).max(86400).default(7200),
    ROOM_LOBBY_TTL_SECONDS: z.coerce.number().int().min(300).max(86400).default(7200),
    ROOM_CODE_COOLDOWN_SECONDS: z.coerce.number().int().min(0).max(604800).default(86400),
    HOST_DISCONNECT_GRACE_SECONDS: z.coerce.number().int().min(5).max(600).default(30),
    ROOM_MAINTENANCE_INTERVAL_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
    EVIDENCE_BUCKET: z.string().min(1).default("imposter-game-private"),
    EVIDENCE_S3_REGION: z.string().min(1).default("us-east-1"),
    EVIDENCE_S3_ENDPOINT: z.string().url().optional(),
    EVIDENCE_S3_FORCE_PATH_STYLE: booleanString,
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
  })
  .transform((values) => ({
    appEnv: values.APP_ENV,
    host: values.HOST,
    port: values.PORT,
    databaseUrl: values.DATABASE_URL,
    databaseSsl: values.DATABASE_SSL,
    databasePoolMax: values.DATABASE_POOL_MAX,
    databaseReadyTimeoutMs: values.DATABASE_READY_TIMEOUT_MS,
    logLevel: values.LOG_LEVEL,
    corsAllowedOrigins: values.CORS_ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    maxJsonBodyBytes: values.MAX_JSON_BODY_BYTES,
    exposeApiDocs: values.EXPOSE_API_DOCS,
    shutdownTimeoutMs: values.SHUTDOWN_TIMEOUT_MS,
    adminSessionTokenPepper: values.ADMIN_SESSION_TOKEN_PEPPER,
    adminSessionTtlSeconds: values.ADMIN_SESSION_TTL_SECONDS,
    adminLoginWindowSeconds: values.ADMIN_LOGIN_WINDOW_SECONDS,
    adminLoginMaxAttempts: values.ADMIN_LOGIN_MAX_ATTEMPTS,
    participantSessionTokenPepper: values.PARTICIPANT_SESSION_TOKEN_PEPPER,
    participantSessionTtlSeconds: values.PARTICIPANT_SESSION_TTL_SECONDS,
    roomLobbyTtlSeconds: values.ROOM_LOBBY_TTL_SECONDS,
    roomCodeCooldownSeconds: values.ROOM_CODE_COOLDOWN_SECONDS,
    hostDisconnectGraceSeconds: values.HOST_DISCONNECT_GRACE_SECONDS,
    roomMaintenanceIntervalMs: values.ROOM_MAINTENANCE_INTERVAL_MS,
    evidenceBucket: values.EVIDENCE_BUCKET,
    evidenceS3Region: values.EVIDENCE_S3_REGION,
    evidenceS3Endpoint: values.EVIDENCE_S3_ENDPOINT,
    evidenceS3ForcePathStyle: values.EVIDENCE_S3_FORCE_PATH_STYLE,
    evidenceUploadTtlSeconds: values.EVIDENCE_UPLOAD_TTL_SECONDS,
    evidenceViewTtlSeconds: values.EVIDENCE_VIEW_TTL_SECONDS,
    evidenceMaxBytes: values.EVIDENCE_MAX_BYTES,
    evidenceGameMaxBytes: values.EVIDENCE_GAME_MAX_BYTES,
    evidenceMaxPixels: values.EVIDENCE_MAX_PIXELS,
    evidenceRetentionSeconds: values.EVIDENCE_RETENTION_SECONDS,
    evidenceOrphanTtlSeconds: values.EVIDENCE_ORPHAN_TTL_SECONDS,
    evidenceWorkerIntervalMs: values.EVIDENCE_WORKER_INTERVAL_MS,
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
