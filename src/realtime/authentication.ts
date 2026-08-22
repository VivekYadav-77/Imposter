import type { Socket } from "socket.io";
import { PARTICIPANT_COOKIE_NAME } from "../shared/security/cookies.js";

export interface ParticipantPrincipal {
  participantId: string;
  roomId: string;
  sessionId: string;
}

export interface ParticipantSessionAuthenticator {
  authenticate(token: string): Promise<ParticipantPrincipal | null>;
}

export class RejectingParticipantSessionAuthenticator implements ParticipantSessionAuthenticator {
  authenticate(): Promise<null> {
    return Promise.resolve(null);
  }
}

function bearerToken(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("Bearer ")) return null;
  const token = value.slice(7).trim();
  return token.length > 0 ? token : null;
}

export function credentialFromSocket(socket: Socket): string | null {
  const handshakeAuth = socket.handshake.auth as Record<string, unknown> | undefined;
  const authToken = handshakeAuth?.token;
  if (typeof authToken === "string" && authToken.length > 0) return authToken;
  const bearer = bearerToken(socket.handshake.headers.authorization);
  if (bearer) return bearer;
  const cookie = socket.handshake.headers.cookie;
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === PARTICIPANT_COOKIE_NAME) return decodeURIComponent(value.join("="));
  }
  return null;
}
