import type { ReactNode } from "react";
import type { IconName } from "./icons";
import type { AvatarId } from "../../shared/avatars";

export type GamePhaseVisual = "lobby" | "role" | "tasks" | "meeting" | "voting" | "results";

export interface GameUtilityAction {
  icon: IconName;
  label: string;
  pressed?: boolean;
  disabled?: boolean;
}

export interface GameShellProps {
  phase: GamePhaseVisual;
  identity?: string;
  avatarId?: AvatarId;
  status?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}

export interface TaskCardViewModel {
  id: string;
  index: number;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  status: "assigned" | "completed";
  proofState: "empty" | "processing" | "ready" | "failed";
  proofUrl?: string;
}

export interface EvidenceViewModel {
  id: string;
  description: string;
  status: "pending" | "ready" | "failed" | "flagged";
  imageUrl?: string;
}

export interface MeetingViewModel {
  sequenceNumber: number;
  stage: "discussion" | "review" | "voting" | "result";
  votesCast: number;
  requiredVotes: number;
  voteVisibility: "public" | "private";
}
