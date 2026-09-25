export type SafeErrorCode =
  | "BAD_REQUEST"
  | "DEPENDENCY_UNAVAILABLE"
  | "FORBIDDEN"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "IDEMPOTENCY_CONFLICT"
  | "INTERNAL_ERROR"
  | "INVALID_CREDENTIALS"
  | "INVALID_PASSWORD"
  | "EMAIL_IN_USE"
  | "USER_SESSION_INVALID"
  | "NOT_FOUND"
  | "PACK_NOT_PUBLISHABLE"
  | "PACK_REVISION_CONFLICT"
  | "PACK_SLUG_CONFLICT"
  | "MAP_IN_USE"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "ROOM_CODE_UNAVAILABLE"
  | "ROOM_FULL"
  | "AVATAR_TAKEN"
  | "ROOM_NOT_FOUND"
  | "ROOM_EXPIRED"
  | "ROOM_NOT_IN_LOBBY"
  | "NICKNAME_TAKEN"
  | "CANNOT_LEAVE_ACTIVE_GAME"
  | "SESSION_ROTATION_CONFLICT"
  | "SESSION_INVALID"
  | "VALIDATION_FAILED"
  | "GAME_NOT_FOUND"
  | "GAME_ALREADY_STARTED"
  | "ROOM_NOT_READY"
  | "ASSIGNMENT_NOT_FOUND"
  | "GAME_STATE_CONFLICT"
  | "ACTION_NOT_ALLOWED_IN_PHASE"
  | "ASSIGNMENT_ALREADY_COMPLETED"
  | "PLAYER_NOT_ELIGIBLE"
  | "STORAGE_UNAVAILABLE"
  | "GAME_UPLOAD_QUOTA_EXCEEDED"
  | "UPLOAD_NOT_FOUND"
  | "UPLOAD_NOT_COMPLETE"
  | "UPLOAD_INVALID"
  | "UPLOAD_ALREADY_CONFIRMED"
  | "UPLOAD_ALREADY_PENDING"
  | "SUBMISSION_NOT_FOUND"
  | "SELF_FLAG_NOT_ALLOWED"
  | "SUBMISSION_ALREADY_RESOLVED"
  | "ALREADY_FLAGGED"
  | "ROLE_NOT_ALLOWED"
  | "KILL_COOLDOWN"
  | "TASK_REQUIRED"
  | "MEETING_LIMIT_REACHED"
  | "MEETING_COOLDOWN"
  | "TARGET_NOT_ELIGIBLE"
  | "MEETING_NOT_FOUND"
  | "REVIEW_ITEM_NOT_FOUND"
  | "REVIEW_LOCKED"
  | "VOTING_LOCKED"
  | "VOTE_ALREADY_CAST"
  | "METHOD_NOT_ALLOWED"
  | "UPLOAD_CAPABILITY_INVALID"
  | "UPLOAD_MISMATCH"
  | "UPLOAD_BUSY"
  | "GAME_NOT_FINISHED";

export class ApplicationError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: SafeErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApplicationError";
  }
}

export function toApplicationError(error: unknown): ApplicationError {
  if (error instanceof ApplicationError) return error;
  return new ApplicationError(500, "INTERNAL_ERROR", "An unexpected error occurred.");
}
