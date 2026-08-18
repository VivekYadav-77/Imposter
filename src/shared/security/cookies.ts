import type { IncomingMessage } from "node:http";

export const ADMIN_COOKIE_NAME = "__Host-admin_session";

export function readCookie(request: IncomingMessage, name: string): string | null {
  const header = request.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [candidate, ...value] = part.trim().split("=");
    if (candidate === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export function adminSessionCookie(token: string, maxAgeSeconds: number): string {
  return `${ADMIN_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearAdminSessionCookie(): string {
  return `${ADMIN_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}
