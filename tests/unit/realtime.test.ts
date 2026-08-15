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
});
