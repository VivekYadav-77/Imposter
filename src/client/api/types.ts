import type { AvatarId } from "../../shared/avatars";

export type TransportState = "connecting" | "connected" | "reconnecting" | "offline" | "revoked";
export type CommandState = "idle" | "submitting" | "retryable_error" | "conflict" | "succeeded";

export interface ResponseMeta {
  requestId: string;
  serverTime: string;
  nextCursor?: string;
}

export interface ApiEnvelope<T> {
  data: T;
  meta: ResponseMeta;
}

export interface ApiErrorBody {
  error: { code: string; message: string; requestId: string; details?: Record<string, unknown> };
}

export interface ParticipantSelf {
  participantId: string;
  nickname: string;
  avatarId: AvatarId;
  isHost: boolean;
  capabilities: string[];
}

export interface RoomSnapshot {
  id: string;
  code: string;
  status: "lobby" | "active" | "completed" | "abandoned" | "expired";
  minPlayers: number;
  maxPlayers: number;
  settings: {
    selectedTaskPack: null | {
      id: string;
      name: string;
      revision: number;
      roles: MapRole[];
      difficultyTaskCounts: Record<TaskDifficulty, number>;
    };
    taskPhaseSeconds: number;
    meetingsPerPlayer: number;
    meetingDurationSeconds: number;
    meetingVotingMode: "timed" | "all_voted";
    voteVisibility: "private" | "public";
    evidenceVisibility: "private" | "public";
    imposterMeetingTaskRequirement: "none" | "one";
    meetingCooldownSeconds: number;
    imposterCooldownSeconds: number;
    estimatedMeetingCooldownSeconds: number;
    imposterCount: number;
    allowedImposterCounts: number[];
    taskCounts: { easy: number; medium: number; hard: number };
    roleCounts: Record<string, number>;
  };
  participants: Array<{
    id: string;
    nickname: string;
    avatarId: AvatarId;
    isHost: boolean;
    presence: "connected" | "away";
    joinedAt: string;
  }>;
  self: ParticipantSelf;
  expiresAt: string;
  gameId: string | null;
}

export interface SessionIssue {
  room: RoomSnapshot;
  participant: ParticipantSelf;
  sessionExpiresAt: string;
}

export interface RoomJoinOptions {
  availableAvatarIds: AvatarId[];
  spotsRemaining: number;
}

export interface PublicPackSummary {
  id: string;
  name: string;
  description: string | null;
  activeTaskCount: number;
  difficultyTaskCounts: Record<TaskDifficulty, number>;
  revision: number;
  roles: MapRole[];
}

export type TaskDifficulty = "easy" | "medium" | "hard";
export interface MapRole {
  name: string;
  specialization: string;
  ability: string;
}

export type LifeStatus = "alive" | "killed" | "ejected";
export type GamePhase =
  "task" | "discussion" | "review" | "voting" | "result" | "game_over" | "abandoned";

export interface MeetingReviewItem {
  id?: string;
  submissionId?: string;
  image?: { url?: string; expiresAt?: string } | null;
  uploader?: { id?: string; nickname?: string };
  description?: string;
  votesCast?: number;
  requiredVotes?: number;
  ownDecision?: "valid" | "invalid" | null;
}

export interface MeetingResult {
  ejectedParticipantId?: string | null;
  outcome?: string;
  votes?: Array<{ targetParticipantId: string | null; count: number }>;
  totals?: Array<{ participantId: string; votes: number }>;
  skipVotes?: number;
  ballots?: PublicBallot[];
  [key: string]: unknown;
}

export interface PublicBallot {
  voterParticipantId: string;
  voterNickname: string;
  voterAvatarId: AvatarId;
  targetParticipantId: string | null;
  targetNickname: string | null;
  targetAvatarId: AvatarId | null;
}

export interface Meeting {
  id: string;
  sequenceNumber: number;
  triggerType: "kill" | "task_deadline" | "user_called";
  reportedParticipantId: string | null;
  phase: "discussion" | "review" | "voting" | "resolved";
  deadlineAt: string | null;
  eligibleParticipants: Array<{ id: string; nickname: string; avatarId: AvatarId }>;
  reviewItem: MeetingReviewItem | null;
  ownEjectionTargetParticipantId: string | null;
  hasCastEjectionVote: boolean;
  votesCast: number;
  requiredVotes: number;
  publicVotes: PublicBallot[];
  result: MeetingResult | null;
  capabilities: string[];
}

export interface GameSnapshot {
  id: string;
  roomId: string;
  phase: GamePhase;
  stateVersion: number;
  winner: "crew" | "imposters" | null;
  endReason:
    | "tasks_completed"
    | "imposters_ejected"
    | "imposter_parity"
    | "time_expired"
    | "abandoned"
    | null;
  taskPack: { name: string };
  phaseStartedAt: string;
  phaseDeadlineAt: string | null;
  participants: Array<{
    id: string;
    nickname: string;
    avatarId: AvatarId;
    isHost: boolean;
    lifeStatus: LifeStatus;
  }>;
  self: {
    participantId: string;
    avatarId: AvatarId;
    role: "crew" | "imposter";
    lifeStatus: LifeStatus;
    capabilities: string[];
    killableParticipantIds: string[];
    knownEliminatedParticipantIds: string[];
    crewRole: MapRole | null;
  };
  assignments: Array<{
    id: string;
    description: string;
    status: "assigned" | "completed";
    completedAt: string | null;
    difficulty: TaskDifficulty;
  }>;
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
    voteVisibility: "private" | "public";
    requiresCompletedTask: boolean;
    maxPerPlayer: number;
    calledBySelf: number;
    remainingForSelf: number;
    hasCompletedTask: boolean;
  };
  meeting: Meeting | null;
  resultSummary: null | {
    durationSeconds: number;
    completedTasks: number;
    totalTasks: number;
    players: Array<{
      id: string;
      nickname: string;
      avatarId: AvatarId;
      role: "crew" | "imposter";
      crewRole: MapRole | null;
      lifeStatus: LifeStatus;
      completedTasks: number;
      totalTasks: number;
    }>;
  };
}

export interface EvidencePolicy {
  version: string;
  minimumAge: 18;
  retentionHours: 24;
  notice: string;
}

export interface UploadIntent {
  uploadId: string;
  expiresAt: string;
  method: "PUT";
  url: string;
  headers: Record<string, string>;
  policy: EvidencePolicy;
}

export interface Submission {
  id: string;
  assignmentId: string;
  uploader: { id: string; nickname: string };
  processingStatus: "pending" | "accepted" | "rejected" | "deleted";
  reviewStatus: "valid" | "flagged" | "invalid";
  createdAt: string;
  image: null | { url: string; expiresAt: string };
  flaggedBySelf: boolean;
}

export interface PackItemInput {
  description: string;
  isActive?: boolean;
  difficulty: TaskDifficulty;
}
export interface PackItem extends PackItemInput {
  id: string;
  position: number;
  isActive: boolean;
}
export type PackStatus = "draft" | "published" | "archived";
export interface AdminPackSummary {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: PackStatus;
  revision: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  activeItemCount: number;
  roles: MapRole[];
}
export interface AdminPack extends Omit<AdminPackSummary, "itemCount" | "activeItemCount"> {
  items: PackItem[];
}

export interface RealtimeBase {
  schemaVersion: number;
  type: string;
  occurredAt: string;
  roomId?: string;
}
export type RealtimeMessage =
  | (RealtimeBase & { type: "room.snapshot"; roomId: string; data: RoomSnapshot })
  | (RealtimeBase & {
      type: "game.snapshot";
      roomId: string;
      gameId: string;
      stateVersion: number;
      data: GameSnapshot;
    })
  | (RealtimeBase & {
      type: "presence.changed";
      roomId: string;
      data: { participantId: string; presence: "connected" | "away" };
    })
  | (RealtimeBase & { type: "session.revoked"; data: { reason: string } })
  | (RealtimeBase & { type: "server.resync_required"; roomId: string; data: { reason: string } })
  | (RealtimeBase & { type: "server.ready" });
