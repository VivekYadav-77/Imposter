import type { GamePhase, GameRole, LifeStatus, Winner } from "./domain.js";

export interface GameAssignmentDto {
  id: string;
  description: string;
  status: "assigned" | "completed";
  completedAt: string | null;
  difficulty: "easy" | "medium" | "hard";
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
    killableParticipantIds: string[];
    knownEliminatedParticipantIds: string[];
    crewRole: null | { name: string; specialization: string; ability: string };
  };
  assignments: GameAssignmentDto[];
  progress: { percent: number };
  cooldowns: {
    killAvailableAt: string | null;
    meetingAvailableAt: string | null;
    meetingCooldownSeconds: number;
    killCooldownSeconds: number;
  };
  meetingRules: {
    durationSeconds: number;
    votingMode: "timed" | "all_voted";
    maxPerPlayer: number;
    calledBySelf: number;
    remainingForSelf: number;
    hasCompletedTask: boolean;
  };
  meeting: MeetingDto | null;
}

export interface MeetingDto {
  id: string;
  sequenceNumber: number;
  triggerType: "kill" | "task_deadline" | "user_called";
  reportedParticipantId: string | null;
  phase: "discussion" | "review" | "voting" | "resolved";
  deadlineAt: string | null;
  eligibleParticipants: Array<{ id: string; nickname: string }>;
  reviewItem: null | {
    id: string;
    submissionId: string;
    position: number;
    total: number;
    uploader: { id: string; nickname: string };
    assignmentDescription: string;
    ownDecision: "valid" | "invalid" | null;
    votesCast: number;
  };
  ownEjectionTargetParticipantId: string | null;
  hasCastEjectionVote: boolean;
  votesCast: number;
  result: null | {
    ejectedParticipantId: string | null;
    totals: Array<{ participantId: string; votes: number }>;
    skipVotes: number;
  };
  capabilities: string[];
}
