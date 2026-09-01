export const EVIDENCE_POLICY = {
  version: "2026-09-20",
  minimumAge: 18,
  retentionHours: 24,
  notice:
    "Photos are visible to players in this room and are used only to run this game. Do not photograph anyone without permission or include sensitive documents. Game photos are deleted within 24 hours after the game ends or expires. By continuing, you confirm that you are at least 18 and have permission to upload this photo.",
} as const;

export interface UploadIntentDto {
  uploadId: string;
  expiresAt: string;
  method: "PUT";
  url: string;
  headers: Record<string, string>;
  policy: typeof EVIDENCE_POLICY;
}

export interface SubmissionDto {
  id: string;
  assignmentId: string;
  uploader: { id: string; nickname: string };
  processingStatus: "pending" | "accepted" | "rejected" | "deleted";
  reviewStatus: "valid" | "flagged" | "invalid";
  createdAt: string;
  image: { url: string; expiresAt: string } | null;
  flaggedBySelf: boolean;
}

export interface ConfirmationDto {
  submission: Omit<SubmissionDto, "uploader" | "image" | "flaggedBySelf">;
  assignmentStatus: "completed";
  progress: { completed: number; total: number };
  stateVersion: number;
}
