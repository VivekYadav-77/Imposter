import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import pino from "pino";
import { io as createClient, type Socket as ClientSocket } from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";

import { loadConfig } from "../../src/infrastructure/configuration/config.js";
import { RejectingParticipantSessionAuthenticator } from "../../src/realtime/authentication.js";
import { attachRealtimeServer } from "../../src/realtime/server.js";

const clients: ClientSocket[] = [];

afterEach(() => {
  for (const client of clients.splice(0)) client.close();
});

describe("realtime authentication boundary", () => {
  it("rejects an invalid handshake with a stable safe code", async () => {
    const httpServer = createServer();
    const config = loadConfig({
      APP_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      CORS_ALLOWED_ORIGINS: "http://localhost",
    });
    const realtime = attachRealtimeServer(
      httpServer,
      config,
      pino({ enabled: false }),
      new RejectingParticipantSessionAuthenticator(),
    );
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const { port } = httpServer.address() as AddressInfo;
    const client = createClient(`http://127.0.0.1:${port}`, {
      path: "/realtime",
      transports: ["websocket"],
      auth: { token: "invalid" },
      reconnection: false,
    });
    clients.push(client);

    const code = await new Promise<string | undefined>((resolve, reject) => {
      client.once("connect", () => reject(new Error("Invalid session connected unexpectedly")));
      client.once("connect_error", (error) => {
        const errorData = (error as Error & { data?: unknown }).data;
        const data = errorData as { code?: string } | undefined;
        resolve(data?.code);
      });
    });
    expect(code).toBe("SESSION_INVALID");

    await new Promise<void>((resolve) => realtime.close(() => resolve()));
  });

  it("accepts the web cookie and sends a participant-specific initial snapshot", async () => {
    const httpServer = createServer();
    const config = loadConfig({
      APP_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      CORS_ALLOWED_ORIGINS: "http://localhost",
    });
    const roomId = "00000000-0000-4000-8000-000000000001";
    const participantId = "00000000-0000-4000-8000-000000000002";
    const realtime = attachRealtimeServer(httpServer, config, pino({ enabled: false }), {
      authenticate: (token) =>
        Promise.resolve(
          token === "valid-cookie"
            ? { roomId, participantId, sessionId: "00000000-0000-4000-8000-000000000003" }
            : null,
        ),
      snapshot: (principal) =>
        Promise.resolve({
          id: roomId,
          code: "ABC234",
          status: "lobby",
          maxPlayers: 12,
          settings: {
            selectedTaskPack: null,
            taskPhaseSeconds: 900,
            discussionSeconds: 90,
            reviewSeconds: 60,
            votingSeconds: 60,
          },
          participants: [],
          self: {
            participantId: principal.participantId,
            nickname: "Asha",
            avatarId: "fox",
            isHost: true,
            capabilities: ["change_settings"],
          },
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          gameId: null,
        }),
    });
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const { port } = httpServer.address() as AddressInfo;
    const client = createClient(`http://127.0.0.1:${port}`, {
      path: "/realtime",
      transports: ["websocket"],
      extraHeaders: { Cookie: "__Host-participant_session=valid-cookie" },
      reconnection: false,
    });
    clients.push(client);
    const message = await new Promise<{
      type: string;
      roomId: string;
      data: { self: { participantId: string } };
    }>((resolve, reject) => {
      client.once("connect_error", reject);
      client.once("room.snapshot", resolve);
    });
    expect(message).toMatchObject({
      type: "room.snapshot",
      roomId,
      data: { self: { participantId } },
    });
    client.close();
    await new Promise<void>((resolve) => realtime.close(() => resolve()));
  });

  it("cancels a pending away transition when the same participant reconnects", async () => {
    const httpServer = createServer();
    const config = loadConfig({
      APP_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      CORS_ALLOWED_ORIGINS: "http://localhost",
      REALTIME_DISCONNECT_GRACE_MS: "100",
    });
    const roomId = "00000000-0000-4000-8000-000000000011";
    const participantId = "00000000-0000-4000-8000-000000000012";
    let connected = 0;
    let disconnected = 0;
    const realtime = attachRealtimeServer(httpServer, config, pino({ enabled: false }), {
      authenticate: () =>
        Promise.resolve({
          roomId,
          participantId,
          sessionId: "00000000-0000-4000-8000-000000000013",
        }),
      markConnected: () => {
        connected += 1;
        return Promise.resolve();
      },
      markDisconnected: () => {
        disconnected += 1;
        return Promise.resolve();
      },
    });
    await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
    const { port } = httpServer.address() as AddressInfo;
    const connect = () => {
      const client = createClient(`http://127.0.0.1:${port}`, {
        path: "/realtime",
        transports: ["websocket"],
        auth: { token: "valid" },
        reconnection: false,
      });
      clients.push(client);
      return new Promise<ClientSocket>((resolve, reject) => {
        client.once("connect", () => resolve(client));
        client.once("connect_error", reject);
      });
    };

    const first = await connect();
    await new Promise<void>((resolve) => {
      first.once("disconnect", () => resolve());
      first.close();
    });
    const second = await connect();
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(connected).toBe(2);
    expect(disconnected).toBe(0);
    second.close();
    await new Promise<void>((resolve) => realtime.close(() => resolve()));
  });
});
