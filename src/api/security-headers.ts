import type { IncomingMessage, ServerResponse } from "node:http";

import type { AppConfig } from "../infrastructure/configuration/config.js";

export function applySecurityHeaders(response: ServerResponse, config: AppConfig): void {
  const imageSources = ["'self'", "blob:", ...config.cspImageSources].join(" ");
  response.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; img-src ${imageSources}; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`,
  );
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
  response.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
  if (config.appEnv === "production")
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}

export function applyCors(
  request: IncomingMessage,
  response: ServerResponse,
  config: AppConfig,
): boolean {
  const origin = request.headers.origin;
  if (!origin) return true;
  if (!config.corsAllowedOrigins.includes(origin)) return false;
  response.setHeader("Access-Control-Allow-Origin", origin);
  response.setHeader("Access-Control-Allow-Credentials", "true");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Idempotency-Key, If-Match, If-Match-State-Version, X-Request-ID, X-Session-Transport",
  );
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  response.setHeader("Vary", "Origin");
  return true;
}
