import type {
  AdminPack,
  AdminPackSummary,
  ApiEnvelope,
  ApiErrorBody,
  GameSnapshot,
  Meeting,
  PublicPackSummary,
  RoomSnapshot,
  SessionIssue,
  Submission,
  UploadIntent,
} from "./types";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly requestId?: string,
    public readonly retryAfterSeconds?: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
  get retryable() {
    return this.status === 0 || this.status === 429 || this.status === 503;
  }
}

export const createIdempotencyKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function parseError(response: Response): Promise<ApiError> {
  let body: ApiErrorBody | undefined;
  try {
    body = (await response.json()) as ApiErrorBody;
  } catch {
    /* safe fallback */
  }
  const retry = response.headers.get("Retry-After");
  return new ApiError(
    response.status,
    body?.error.code ?? `HTTP_${response.status}`,
    body?.error.message ?? "That request could not be completed.",
    body?.error.requestId ?? response.headers.get("X-Request-Id") ?? undefined,
    retry ? Number(retry) : undefined,
    body?.error.details,
  );
}

interface RequestOptions extends RequestInit {
  idempotencyKey?: string;
  retry?: boolean;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.idempotencyKey) headers.set("Idempotency-Key", options.idempotencyKey);
  const attempts = options.retry === false ? 1 : 3;
  let lastError: ApiError | undefined;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(path, {
        ...options,
        headers,
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!response.ok) {
        const error = await parseError(response);
        if (!error.retryable || attempt === attempts - 1) throw error;
        lastError = error;
        const delay = error.retryAfterSeconds
          ? error.retryAfterSeconds * 1000
          : 300 * 2 ** attempt + Math.random() * 100;
        await wait(delay);
        continue;
      }
      if (response.status === 204)
        return {
          data: undefined as T,
          meta: {
            requestId: response.headers.get("X-Request-Id") ?? "",
            serverTime: new Date().toISOString(),
          },
        };
      return (await response.json()) as ApiEnvelope<T>;
    } catch (error) {
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError(0, "NETWORK_ERROR", "The network connection was interrupted.");
      if (!apiError.retryable || attempt === attempts - 1) throw apiError;
      lastError = apiError;
      await wait(300 * 2 ** attempt + Math.random() * 100);
    }
  }
  throw lastError ?? new ApiError(0, "NETWORK_ERROR", "The request failed.");
}

const json = (body: unknown) => JSON.stringify(body);
export const participantApi = {
  createRoom: (
    nickname: string,
    minPlayersOrKey: number | string = 3,
    maxPlayers = 12,
    key = createIdempotencyKey(),
  ) =>
    apiRequest<SessionIssue>("/api/v1/rooms", {
      method: "POST",
      body: json(
        typeof minPlayersOrKey === "number"
          ? { nickname, minPlayers: minPlayersOrKey, maxPlayers }
          : { nickname },
      ),
      headers: { "X-Session-Transport": "cookie" },
      idempotencyKey: typeof minPlayersOrKey === "string" ? minPlayersOrKey : key,
    }),
  joinRoom: (code: string, nickname: string, key = createIdempotencyKey()) =>
    apiRequest<SessionIssue>(`/api/v1/rooms/${encodeURIComponent(code)}/participants`, {
      method: "POST",
      body: json({ nickname }),
      headers: { "X-Session-Transport": "cookie" },
      idempotencyKey: key,
    }),
  room: () => apiRequest<RoomSnapshot>("/api/v1/rooms/current"),
  packs: () => apiRequest<PublicPackSummary[]>("/api/v1/task-packs?limit=50"),
  updateSettings: (body: Record<string, unknown>, key = createIdempotencyKey()) =>
    apiRequest<RoomSnapshot>("/api/v1/rooms/current/settings", {
      method: "PATCH",
      body: json(body),
      idempotencyKey: key,
    }),
  start: (key = createIdempotencyKey()) =>
    apiRequest<GameSnapshot>("/api/v1/rooms/current/start", {
      method: "POST",
      body: "{}",
      idempotencyKey: key,
    }),
  leave: (key = createIdempotencyKey()) =>
    apiRequest<{ left: true }>("/api/v1/rooms/current/leave", {
      method: "POST",
      body: "{}",
      idempotencyKey: key,
    }),
  snapshot: (knownStateVersion?: number) =>
    apiRequest<GameSnapshot>(
      `/api/v1/games/current/snapshot${knownStateVersion === undefined ? "" : `?knownStateVersion=${knownStateVersion}`}`,
    ),
  meeting: () => apiRequest<Meeting>("/api/v1/meetings/current"),
  kill: (targetParticipantId: string, expectedStateVersion: number, key = createIdempotencyKey()) =>
    apiRequest<GameSnapshot>("/api/v1/games/current/kills", {
      method: "POST",
      body: json({ targetParticipantId, expectedStateVersion }),
      idempotencyKey: key,
    }),
  reviewVote: (
    id: string,
    decision: "valid" | "invalid",
    expectedStateVersion: number,
    key = createIdempotencyKey(),
  ) =>
    apiRequest(`/api/v1/evidence-review-items/${id}/vote`, {
      method: "PUT",
      body: json({ decision, expectedStateVersion }),
      idempotencyKey: key,
    }),
  ejectionVote: (
    meetingId: string,
    targetParticipantId: string | null,
    expectedStateVersion: number,
    key = createIdempotencyKey(),
  ) =>
    apiRequest(`/api/v1/meetings/${meetingId}/ejection-vote`, {
      method: "PUT",
      body: json({ targetParticipantId, expectedStateVersion }),
      idempotencyKey: key,
    }),
  uploadIntent: (
    assignmentId: string,
    file: File,
    expectedStateVersion: number,
    key = createIdempotencyKey(),
  ) =>
    apiRequest<UploadIntent>(`/api/v1/task-assignments/${assignmentId}/upload-intents`, {
      method: "POST",
      body: json({ expectedStateVersion, contentType: file.type, byteSize: file.size }),
      idempotencyKey: key,
    }),
  confirmUpload: (
    assignmentId: string,
    uploadId: string,
    expectedStateVersion: number,
    key = createIdempotencyKey(),
  ) =>
    apiRequest(`/api/v1/task-assignments/${assignmentId}/submissions`, {
      method: "POST",
      body: json({ expectedStateVersion, uploadId }),
      idempotencyKey: key,
    }),
  submissions: () => apiRequest<Submission[]>("/api/v1/games/current/submissions?limit=50"),
  flag: (
    id: string,
    expectedStateVersion: number,
    reason: string | null,
    key = createIdempotencyKey(),
  ) =>
    apiRequest(`/api/v1/submissions/${id}/flags`, {
      method: "POST",
      body: json({ expectedStateVersion, reason }),
      idempotencyKey: key,
    }),
  deleteSession: () =>
    apiRequest<void>("/api/v1/participant-sessions/current", { method: "DELETE", retry: false }),
};

export const adminApi = {
  login: (email: string, password: string) =>
    apiRequest<void>("/api/v1/admin/sessions", {
      method: "POST",
      body: json({ email, password }),
      retry: false,
    }),
  logout: () =>
    apiRequest<void>("/api/v1/admin/sessions/current", { method: "DELETE", retry: false }),
  list: (query = "") =>
    apiRequest<AdminPackSummary[]>(`/api/v1/admin/task-packs${query ? `?${query}` : ""}`),
  get: (id: string) => apiRequest<AdminPack>(`/api/v1/admin/task-packs/${id}`),
  create: (
    body: {
      name: string;
      description: string | null;
      items: Array<{
        description: string;
        isActive: boolean;
        difficulty: "easy" | "medium" | "hard";
      }>;
      roles: Array<{ name: string; specialization: string; ability: string }>;
    },
    key = createIdempotencyKey(),
  ) =>
    apiRequest<AdminPack>("/api/v1/admin/task-packs", {
      method: "POST",
      body: json(body),
      idempotencyKey: key,
    }),
  update: (
    id: string,
    body: {
      expectedRevision: number;
      name: string;
      description: string | null;
      items: Array<{
        description: string;
        isActive: boolean;
        difficulty: "easy" | "medium" | "hard";
      }>;
      roles: Array<{ name: string; specialization: string; ability: string }>;
    },
    key = createIdempotencyKey(),
  ) =>
    apiRequest<AdminPack>(`/api/v1/admin/task-packs/${id}`, {
      method: "PATCH",
      body: json(body),
      idempotencyKey: key,
    }),
  publish: (id: string, expectedRevision: number, key = createIdempotencyKey()) =>
    apiRequest<AdminPack>(`/api/v1/admin/task-packs/${id}/publish`, {
      method: "POST",
      body: json({ expectedRevision }),
      idempotencyKey: key,
    }),
  archive: (id: string, expectedRevision: number, key = createIdempotencyKey()) =>
    apiRequest<AdminPack>(`/api/v1/admin/task-packs/${id}/archive`, {
      method: "POST",
      body: json({ expectedRevision }),
      idempotencyKey: key,
    }),
};

export const errorMessage = (error: unknown) =>
  error instanceof ApiError ? error.message : "Something went wrong. Try again.";
