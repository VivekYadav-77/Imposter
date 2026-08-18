import type { IncomingMessage, ServerResponse } from "node:http";

import type { AppConfig } from "../infrastructure/configuration/config.js";

export function applySecurityHeaders(response: ServerResponse): void {
  response.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; frame-ancestors 'none'; base-uri 'self'",
  );
  response.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("X-Frame-Options", "DENY");
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
    "Content-Type, Idempotency-Key, If-Match, If-Match-State-Version, X-Request-ID",
  );
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  response.setHeader("Vary", "Origin");
  return true;
}
