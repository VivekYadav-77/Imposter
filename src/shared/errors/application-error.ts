export type SafeErrorCode =
  | "BAD_REQUEST"
  | "DEPENDENCY_UNAVAILABLE"
  | "FORBIDDEN"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "IDEMPOTENCY_CONFLICT"
  | "INTERNAL_ERROR"
  | "INVALID_CREDENTIALS"
  | "NOT_FOUND"
  | "PACK_NOT_PUBLISHABLE"
  | "PACK_REVISION_CONFLICT"
  | "PACK_SLUG_CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "RATE_LIMITED"
  | "SESSION_INVALID"
  | "VALIDATION_FAILED";

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
