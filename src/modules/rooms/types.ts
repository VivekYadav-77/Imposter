export type RoomStatus = "lobby" | "active" | "completed" | "abandoned" | "expired";

export interface ParticipantPrincipal {
  participantId: string;
  roomId: string;
  sessionId: string;
}

export interface ParticipantDto {
  id: string;
  nickname: string;
  isHost: boolean;
  presence: "connected" | "away";
  joinedAt: string;
}

export interface RoomSnapshotDto {
  id: string;
  code: string;
  status: RoomStatus;
  maxPlayers: 12;
  settings: {
    selectedTaskPack: { id: string; name: string; revision: number } | null;
    taskPhaseSeconds: number;
    discussionSeconds: number;
    reviewSeconds: number;
    votingSeconds: number;
  };
  participants: ParticipantDto[];
  self: { participantId: string; nickname: string; isHost: boolean; capabilities: string[] };
  expiresAt: string;
  gameId: string | null;
}

export interface SessionIssueDto {
  room: RoomSnapshotDto;
  participant: RoomSnapshotDto["self"];
  sessionToken: string;
  sessionExpiresAt: string;
}

export interface PresenceUpdate {
  roomId: string;
  participantId: string;
  presence: "connected" | "away";
  occurredAt: string;
}
