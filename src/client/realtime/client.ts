import { io, type Socket } from "socket.io-client";
import type { RealtimeMessage, TransportState } from "../api/types";

export interface RealtimeHandlers {
  onMessage: (message: RealtimeMessage) => void;
  onTransport: (state: TransportState) => void;
  onResync: () => void;
}

export class RealtimeClient {
  private socket: Socket | null = null;
  private lastVersion = 0;
  constructor(private readonly handlers: RealtimeHandlers) {}

  connect() {
    if (this.socket) return;
    this.handlers.onTransport("connecting");
    const socket = io({
      path: "/realtime",
      transports: ["websocket"],
      withCredentials: true,
      reconnection: true,
    });
    this.socket = socket;
    socket.on("connect", () => this.handlers.onTransport("connected"));
    socket.io.on("reconnect_attempt", () => this.handlers.onTransport("reconnecting"));
    socket.on("disconnect", (reason) =>
      this.handlers.onTransport(reason === "io server disconnect" ? "offline" : "reconnecting"),
    );
    for (const event of [
      "room.snapshot",
      "game.snapshot",
      "presence.changed",
      "session.revoked",
      "server.resync_required",
      "server.ready",
    ]) {
      socket.on(event, (payload: unknown) => this.receive(payload));
    }
  }

  private receive(payload: unknown) {
    if (!payload || typeof payload !== "object") return;
    const message = payload as RealtimeMessage;
    if (message.schemaVersion !== 1) {
      this.handlers.onResync();
      return;
    }
    if (message.type === "session.revoked") this.handlers.onTransport("revoked");
    if (message.type === "server.resync_required") this.handlers.onResync();
    if (message.type === "game.snapshot") {
      if (this.lastVersion && message.stateVersion > this.lastVersion + 1) this.handlers.onResync();
      this.lastVersion = message.stateVersion;
    }
    this.handlers.onMessage(message);
  }

  requestResync(knownStateVersion: number) {
    this.socket?.emit("game.resync", { schemaVersion: 1, knownStateVersion });
  }
  destroy() {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }
}
