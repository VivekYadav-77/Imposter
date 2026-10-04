import { createHmac, randomBytes } from "node:crypto";

export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSecret(value: string, pepper: string): string {
  return createHmac("sha256", pepper).update(value).digest("base64url");
}
