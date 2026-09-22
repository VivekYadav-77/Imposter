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
  minPlayers?: number;
  maxPlayers: number;
  settings: {
    selectedTaskPack: {
      id: string;
      name: string;
      revision: number;
      roles: Array<{ name: string; specialization: string; ability: string }>;
      difficultyTaskCounts: { easy: number; medium: number; hard: number };
    } | null;
    taskPhaseSeconds: number;
    meetingsPerPlayer?: number;
    meetingDurationSeconds?: number;
    meetingVotingMode?: "timed" | "all_voted";
    voteVisibility?: "private" | "public";
    evidenceVisibility?: "private" | "public";
    imposterMeetingTaskRequirement?: "none" | "one";
    meetingCooldownSeconds?: number;
    imposterCooldownSeconds?: number;
    estimatedMeetingCooldownSeconds?: number;
    imposterCount?: number;
    allowedImposterCounts?: number[];
    taskCounts?: { easy: number; medium: number; hard: number };
    roleCounts?: Record<string, number>;
    discussionSeconds?: number;
    reviewSeconds?: number;
    votingSeconds?: number;
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
