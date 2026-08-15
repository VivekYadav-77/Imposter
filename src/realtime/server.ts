import type { Server as HttpServer } from "node:http";
import type { Logger } from "pino";
import { Server } from "socket.io";

import type { AppConfig } from "../infrastructure/configuration/config.js";
import { credentialFromSocket, type ParticipantSessionAuthenticator } from "./authentication.js";

export function attachRealtimeServer(
  httpServer: HttpServer,
  config: AppConfig,
  logger: Logger,
  authenticator: ParticipantSessionAuthenticator,
): Server {
  const io = new Server(httpServer, {
    path: "/realtime",
    serveClient: false,
    transports: ["websocket"],
    maxHttpBufferSize: config.maxJsonBodyBytes,
    cors: { origin: config.corsAllowedOrigins, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = credentialFromSocket(socket);
      const principal = token ? await authenticator.authenticate(token) : null;
      if (!principal) {
        const error = new Error("Session is invalid.");
        Object.assign(error, { data: { code: "SESSION_INVALID" } });
        next(error);
        return;
      }
      const socketData = socket.data as Record<string, unknown>;
      socketData.principal = principal;
      next();
    } catch (error) {
      logger.warn({ err: error }, "Realtime authentication failed");
      const safeError = new Error("Session is invalid.");
      Object.assign(safeError, { data: { code: "SESSION_INVALID" } });
      next(safeError);
    }
  });

  io.on("connection", (socket) => {
    const socketData = socket.data as Record<string, unknown>;
    const principal = socketData.principal as { roomId: string };
    void socket.join(`room:${principal.roomId}`);
    socket.emit("server.ready", { schemaVersion: 1, occurredAt: new Date().toISOString() });
  });

  return io;
}
