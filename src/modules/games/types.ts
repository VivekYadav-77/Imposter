import type { GamePhase, GameRole, LifeStatus, Winner } from "./domain.js";

export interface GameAssignmentDto {
  id: string;
  description: string;
  status: "assigned" | "completed";
  completedAt: string | null;
}

export interface GameSnapshotDto {
  id: string;
  roomId: string;
  phase: GamePhase;
  stateVersion: number;
  winner: Winner | null;
  taskPack: { name: string };
  phaseStartedAt: string;
  phaseDeadlineAt: string | null;
  participants: Array<{
    id: string;
    nickname: string;
    isHost: boolean;
    lifeStatus: LifeStatus;
  }>;
  self: {
    participantId: string;
    role: GameRole;
    lifeStatus: LifeStatus;
    capabilities: string[];
  };
  assignments: GameAssignmentDto[];
  progress: { completed: number; total: number };
}
