import type { Server as HttpServer } from "node:http";
import type { Logger } from "pino";
import { Server, type Socket } from "socket.io";

import type { AppConfig } from "../infrastructure/configuration/config.js";
import type { Metrics } from "../infrastructure/observability/metrics.js";
import { credentialFromSocket, type ParticipantSessionAuthenticator } from "./authentication.js";
import type {
  ParticipantPrincipal,
  PresenceUpdate,
  RoomSnapshotDto,
} from "../modules/rooms/types.js";
import type { GameSnapshotDto } from "../modules/games/types.js";

interface RealtimeRoomProvider extends ParticipantSessionAuthenticator {
  snapshot?(principal: ParticipantPrincipal): Promise<RoomSnapshotDto>;
  markConnected?(principal: ParticipantPrincipal): Promise<void>;
  markDisconnected?(principal: ParticipantPrincipal): Promise<void>;
  events?: {
    on(event: "room.changed", listener: (roomId: string) => void): unknown;
    on(event: "presence.changed", listener: (update: PresenceUpdate) => void): unknown;
    on(event: "session.revoked", listener: (sessionId: string, reason: string) => void): unknown;
  };
}

interface RealtimeGameProvider {
  snapshot(principal: ParticipantPrincipal): Promise<GameSnapshotDto>;
  events: {
    on(
      event: "game.changed",
      listener: (update: { roomId: string; gameId: string; stateVersion: number }) => void,
    ): unknown;
  };
}

export function attachRealtimeServer(
  httpServer: HttpServer,
  config: AppConfig,
  logger: Logger,
  authenticator: RealtimeRoomProvider,
  games?: RealtimeGameProvider,
  metrics?: Metrics,
): Server {
  const io = new Server(httpServer, {
    path: "/realtime",
    serveClient: false,
    transports: ["websocket"],
    maxHttpBufferSize: config.maxJsonBodyBytes,
    pingInterval: config.realtimePingIntervalMs,
    pingTimeout: config.realtimePingTimeoutMs,
    cors: { origin: config.corsAllowedOrigins, credentials: true },
  });

  io.use(async (socket, next) => {
    try {
      const token = credentialFromSocket(socket);
      const principal = token ? await authenticator.authenticate(token) : null;
      if (!principal) {
        metrics?.increment("realtime.authentication_failures");
        const error = new Error("Session is invalid.");
        Object.assign(error, { data: { code: "SESSION_INVALID" } });
        next(error);
        return;
      }
      const socketData = socket.data as Record<string, unknown>;
      socketData.principal = principal;
      next();
    } catch (error) {
      metrics?.increment("realtime.authentication_failures");
      logger.warn({ err: error }, "Realtime authentication failed");
      const safeError = new Error("Session is invalid.");
      Object.assign(safeError, { data: { code: "SESSION_INVALID" } });
      next(safeError);
    }
  });

  const emitSnapshot = async (socket: Socket) => {
    if (!authenticator.snapshot) return;
    const principal = (socket.data as Record<string, unknown>).principal as ParticipantPrincipal;
    const snapshot = await authenticator.snapshot(principal);
    socket.emit("room.snapshot", {
      schemaVersion: 1,
      type: "room.snapshot",
      roomId: principal.roomId,
      occurredAt: new Date().toISOString(),
      data: snapshot,
    });
  };

  const emitGameSnapshot = async (socket: Socket) => {
    if (!games) return;
    const principal = (socket.data as Record<string, unknown>).principal as ParticipantPrincipal;
    try {
      const snapshot = await games.snapshot(principal);
      socket.emit("game.snapshot", {
        schemaVersion: 1,
        type: "game.snapshot",
        roomId: principal.roomId,
        gameId: snapshot.id,
        stateVersion: snapshot.stateVersion,
        occurredAt: new Date().toISOString(),
        data: snapshot,
      });
    } catch (error) {
      if ((error as { code?: string }).code !== "GAME_NOT_FOUND") throw error;
    }
  };

  io.on("connection", (socket) => {
    metrics?.increment("realtime.connections");
    metrics?.set("realtime.active_connections", io.engine.clientsCount);
    const socketData = socket.data as Record<string, unknown>;
    const principal = socketData.principal as ParticipantPrincipal;
    void socket.join(`room:${principal.roomId}`);
    void socket.join(`session:${principal.sessionId}`);
    void socket.join(`participant:${principal.participantId}`);
    void authenticator
      .markConnected?.(principal)
      .catch((error: unknown) =>
        logger.warn({ err: error, roomId: principal.roomId }, "Realtime presence update failed"),
      );
    socket.emit("server.ready", { schemaVersion: 1, occurredAt: new Date().toISOString() });
    void emitSnapshot(socket).catch((error: unknown) => {
      logger.warn({ err: error, roomId: principal.roomId }, "Initial room snapshot failed");
      socket.emit("server.resync_required", {
        schemaVersion: 1,
        type: "server.resync_required",
        roomId: principal.roomId,
        occurredAt: new Date().toISOString(),
        data: { reason: "snapshot_failed" },
      });
    });
    void emitGameSnapshot(socket).catch((error: unknown) => {
      logger.warn({ err: error, roomId: principal.roomId }, "Initial game snapshot failed");
    });
    socket.on("heartbeat", (ack?: (value: unknown) => void) => {
      ack?.({
        occurredAt: new Date().toISOString(),
        reconnect: {
          strategy: "exponential",
          initialDelayMs: 500,
          maximumDelayMs: 10000,
          jitter: true,
        },
      });
    });
    socket.on("room.resync", () => void emitSnapshot(socket));
    socket.on("game.resync", () => void emitGameSnapshot(socket));
    socket.on("disconnect", () => {
      metrics?.increment("realtime.disconnects");
      metrics?.set("realtime.active_connections", Math.max(0, io.engine.clientsCount));
      const remaining =
        io.sockets.adapter.rooms.get(`participant:${principal.participantId}`)?.size ?? 0;
      if (remaining === 0)
        void authenticator
          .markDisconnected?.(principal)
          .catch((error: unknown) =>
            logger.warn(
              { err: error, roomId: principal.roomId },
              "Realtime disconnect persistence failed",
            ),
          );
    });
  });

  authenticator.events?.on("room.changed", (roomId) => {
    const sockets = io.sockets.adapter.rooms.get(`room:${roomId}`);
    if (!sockets) return;
    for (const socketId of sockets) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) void emitSnapshot(socket);
    }
  });
  authenticator.events?.on("presence.changed", (update) => {
    io.to(`room:${update.roomId}`).emit("presence.changed", {
      schemaVersion: 1,
      type: "presence.changed",
      roomId: update.roomId,
      occurredAt: update.occurredAt,
      data: { participantId: update.participantId, presence: update.presence },
    });
  });
  authenticator.events?.on("session.revoked", (sessionId, reason) => {
    io.to(`session:${sessionId}`).emit("session.revoked", {
      schemaVersion: 1,
      type: "session.revoked",
      occurredAt: new Date().toISOString(),
      data: { reason },
    });
    void io.in(`session:${sessionId}`).disconnectSockets(true);
  });
  games?.events.on("game.changed", (update) => {
    const sockets = io.sockets.adapter.rooms.get(`room:${update.roomId}`);
    if (!sockets) return;
    for (const socketId of sockets) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) void emitGameSnapshot(socket);
    }
  });

  return io;
}
