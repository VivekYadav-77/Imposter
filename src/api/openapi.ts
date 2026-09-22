import type { OpenAPIObject } from "openapi3-ts/oas31";

const metaSchema = {
  type: "object" as const,
  required: ["requestId", "serverTime"],
  properties: {
    requestId: { type: "string" as const },
    serverTime: { type: "string" as const, format: "date-time" },
  },
};
const envelope = (schema: object, description = "Successful response") => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object" as const,
        required: ["data", "meta"],
        properties: { data: schema, meta: metaSchema },
      },
    },
  },
});
const error = {
  description: "Safe error envelope",
  content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } },
};
const idempotency = {
  name: "Idempotency-Key",
  in: "header" as const,
  required: true,
  schema: { type: "string" as const, minLength: 8, maxLength: 128 },
};
const sessionTransport = {
  name: "X-Session-Transport",
  in: "header" as const,
  required: false,
  description: "Set to cookie for the same-origin web adapter; defaults to bearer-token JSON.",
  schema: { type: "string" as const, enum: ["cookie", "bearer"] },
};
const packId = {
  name: "packId",
  in: "path" as const,
  required: true,
  schema: { type: "string" as const, format: "uuid" },
};
const adminSecurity = [{ adminCookie: [] }];
const participantSecurity: NonNullable<OpenAPIObject["security"]> = [
  { participantBearer: [] },
  { participantCookie: [] },
];

export const openApiDocument: OpenAPIObject = {
  openapi: "3.1.0",
  info: {
    title: "Imposter Game API",
    version: "1.0.0",
    description:
      "Frozen v1 HTTP contract for web and native clients. Additive changes remain within /api/v1; breaking changes require /api/v2.",
  },
  servers: [{ url: "/" }],
  paths: {
    "/health/live": {
      get: {
        operationId: "getLiveness",
        responses: { "200": envelope({ $ref: "#/components/schemas/Health" }, "Health status") },
      },
    },
    "/health/ready": {
      get: {
        operationId: "getReadiness",
        responses: {
          "200": envelope({ $ref: "#/components/schemas/Health" }, "Health status"),
          "503": error,
        },
      },
    },
    "/api/v1": {
      get: {
        operationId: "getApiVersion",
        responses: {
          "200": envelope({
            type: "object",
            required: ["version"],
            properties: { version: { type: "string", const: "v1" } },
          }),
        },
      },
    },
    "/api/v1/rooms": {
      post: {
        operationId: "createRoom",
        summary: "Create a lobby and host participant session",
        parameters: [idempotency, sessionTransport],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/RoomCreationInput" } },
          },
        },
        responses: {
          "201": envelope({ $ref: "#/components/schemas/SessionIssue" }),
          "409": error,
          "422": error,
          "429": error,
        },
      },
    },
    "/api/v1/rooms/{code}/participants": {
      post: {
        operationId: "joinRoom",
        summary: "Join an open lobby",
        parameters: [
          {
            name: "code",
            in: "path",
            required: true,
            schema: { type: "string", pattern: "^[A-Za-z0-9]{6}$" },
          },
          idempotency,
          sessionTransport,
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/RoomMembershipInput" } },
          },
        },
        responses: {
          "201": envelope({ $ref: "#/components/schemas/SessionIssue" }),
          "404": error,
          "409": error,
          "422": error,
          "429": error,
        },
      },
    },
    "/api/v1/rooms/current": {
      get: {
        operationId: "getCurrentRoom",
        security: participantSecurity,
        responses: {
          "200": envelope({ $ref: "#/components/schemas/RoomSnapshot" }),
          "401": error,
          "404": error,
        },
      },
    },
    "/api/v1/rooms/current/settings": {
      patch: {
        operationId: "updateRoomSettings",
        security: participantSecurity,
        parameters: [idempotency],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/RoomSettingsInput" } },
          },
        },
        responses: {
          "200": envelope({ $ref: "#/components/schemas/RoomSnapshot" }),
          "401": error,
          "403": error,
          "409": error,
          "422": error,
        },
      },
    },
    "/api/v1/rooms/current/leave": {
      post: {
        operationId: "leaveRoom",
        security: participantSecurity,
        parameters: [idempotency],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { type: "object", additionalProperties: false } },
          },
        },
        responses: {
          "200": envelope({
            type: "object",
            required: ["left"],
            properties: { left: { type: "boolean", const: true } },
          }),
          "401": error,
          "409": error,
        },
      },
    },
    "/api/v1/rooms/current/start": {
      post: {
        operationId: "startGame",
        security: participantSecurity,
        parameters: [idempotency],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { type: "object", additionalProperties: false } },
          },
        },
        responses: {
          "201": envelope({ $ref: "#/components/schemas/GameSnapshot" }),
          "401": error,
          "403": error,
          "409": error,
          "422": error,
        },
      },
    },
    "/api/v1/rooms/current/replay": {
      post: {
        operationId: "replayRoom",
        security: participantSecurity,
        parameters: [idempotency],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { type: "object", additionalProperties: false } },
          },
        },
        responses: {
          "200": envelope({ $ref: "#/components/schemas/RoomSnapshot" }),
          "401": error,
          "409": error,
        },
      },
    },
    "/api/v1/games/current/snapshot": {
      get: {
        operationId: "getCurrentGameSnapshot",
        security: participantSecurity,
        parameters: [
          {
            name: "knownStateVersion",
            in: "query",
            schema: { type: "integer", minimum: 0 },
          },
        ],
        responses: {
          "200": envelope({ $ref: "#/components/schemas/GameSnapshot" }),
          "204": { description: "The supplied state version is current" },
          "401": error,
          "404": error,
          "422": error,
        },
      },
    },
    "/api/v1/games/current/kills": {
      post: {
        operationId: "createKill",
        security: participantSecurity,
        parameters: [idempotency],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["expectedStateVersion", "targetParticipantId"],
                properties: {
                  expectedStateVersion: { type: "integer", minimum: 1 },
                  targetParticipantId: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
        responses: {
          "201": envelope({ $ref: "#/components/schemas/GameSnapshot" }),
          "403": error,
          "409": error,
          "422": error,
        },
      },
    },
    "/api/v1/games/current/meetings": {
      post: {
        operationId: "callMeeting",
        security: participantSecurity,
        parameters: [idempotency],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["expectedStateVersion"],
                properties: { expectedStateVersion: { type: "integer", minimum: 1 } },
              },
            },
          },
        },
        responses: {
          "201": envelope({ $ref: "#/components/schemas/GameSnapshot" }),
          "403": error,
          "409": error,
          "422": error,
        },
      },
    },
    "/api/v1/meetings/current": {
      get: {
        operationId: "getCurrentMeeting",
        security: participantSecurity,
        responses: { "200": envelope({ $ref: "#/components/schemas/Meeting" }), "404": error },
      },
    },
    "/api/v1/evidence-review-items/{reviewItemId}/vote": {
      put: {
        operationId: "putEvidenceReviewVote",
        security: participantSecurity,
        parameters: [
          {
            name: "reviewItemId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          idempotency,
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["expectedStateVersion", "decision"],
                properties: {
                  expectedStateVersion: { type: "integer", minimum: 1 },
                  decision: { type: "string", enum: ["valid", "invalid"] },
                },
              },
            },
          },
        },
        responses: {
          "200": envelope({ $ref: "#/components/schemas/VoteAcknowledgement" }),
          "403": error,
          "404": error,
          "409": error,
          "422": error,
        },
      },
    },
    "/api/v1/meetings/{meetingId}/ejection-vote": {
      put: {
        operationId: "putEjectionVote",
        security: participantSecurity,
        parameters: [
          {
            name: "meetingId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          idempotency,
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["expectedStateVersion", "targetParticipantId"],
                properties: {
                  expectedStateVersion: { type: "integer", minimum: 1 },
                  targetParticipantId: { type: ["string", "null"], format: "uuid" },
                },
              },
            },
          },
        },
        responses: {
          "200": envelope({ $ref: "#/components/schemas/VoteAcknowledgement" }),
          "403": error,
          "404": error,
          "409": error,
          "422": error,
        },
      },
    },
    "/api/v1/task-assignments/{assignmentId}/upload-intents": {
      post: {
        operationId: "createEvidenceUploadIntent",
        security: participantSecurity,
        parameters: [
          {
            name: "assignmentId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          idempotency,
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["expectedStateVersion", "contentType", "byteSize"],
                properties: {
                  expectedStateVersion: { type: "integer", minimum: 1 },
                  contentType: { type: "string", enum: ["image/jpeg", "image/png", "image/webp"] },
                  byteSize: { type: "integer", minimum: 1, maximum: 5242880 },
                  checksum: { type: ["string", "null"], pattern: "^[A-Za-z0-9+/]{43}=$" },
                },
              },
            },
          },
        },
        responses: {
          "201": envelope({ $ref: "#/components/schemas/UploadIntent" }),
          "401": error,
          "403": error,
          "404": error,
          "409": error,
          "413": error,
          "422": error,
          "503": error,
        },
      },
    },
    "/api/v1/task-assignments/{assignmentId}/submissions": {
      post: {
        operationId: "confirmEvidenceSubmission",
        security: participantSecurity,
        parameters: [
          {
            name: "assignmentId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          idempotency,
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["expectedStateVersion", "uploadId"],
                properties: {
                  expectedStateVersion: { type: "integer", minimum: 1 },
                  uploadId: { type: "string", format: "uuid" },
                },
              },
            },
          },
        },
        responses: {
          "201": envelope({ $ref: "#/components/schemas/SubmissionConfirmation" }),
          "401": error,
          "403": error,
          "404": error,
          "409": error,
          "422": error,
          "503": error,
        },
      },
    },
    "/api/v1/games/current/submissions": {
      get: {
        operationId: "listCurrentGameSubmissions",
        security: participantSecurity,
        parameters: [
          { name: "cursor", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50 } },
          { name: "flagged", in: "query", schema: { type: "boolean" } },
        ],
        responses: {
          "200": envelope({ type: "array", items: { $ref: "#/components/schemas/Submission" } }),
          "401": error,
          "404": error,
          "503": error,
        },
      },
    },
    "/api/v1/submissions/{submissionId}/flags": {
      post: {
        operationId: "flagEvidenceSubmission",
        security: participantSecurity,
        parameters: [
          {
            name: "submissionId",
            in: "path",
            required: true,
            schema: { type: "string", format: "uuid" },
          },
          idempotency,
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                required: ["expectedStateVersion"],
                properties: {
                  expectedStateVersion: { type: "integer", minimum: 1 },
                  reason: { type: ["string", "null"], maxLength: 280 },
                },
              },
            },
          },
        },
        responses: {
          "201": envelope({
            type: "object",
            required: ["submissionId", "reviewStatus", "stateVersion"],
            properties: {
              submissionId: { type: "string", format: "uuid" },
              reviewStatus: { type: "string", const: "flagged" },
              stateVersion: { type: "integer", minimum: 1 },
            },
          }),
          "401": error,
          "403": error,
          "404": error,
          "409": error,
          "422": error,
        },
      },
    },
    "/api/v1/participant-sessions/current/rotate": {
      post: {
        operationId: "rotateParticipantSession",
        security: participantSecurity,
        parameters: [idempotency, sessionTransport],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { type: "object", additionalProperties: false } },
          },
        },
        responses: {
          "200": envelope({ $ref: "#/components/schemas/SessionCredential" }),
          "401": error,
          "409": error,
        },
      },
    },
    "/api/v1/participant-sessions/current": {
      delete: {
        operationId: "deleteParticipantSession",
        security: participantSecurity,
        responses: { "204": { description: "Session revoked" }, "401": error },
      },
    },
    "/api/v1/admin/sessions": {
      post: {
        operationId: "createAdminSession",
        summary: "Authenticate a pre-provisioned administrator",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/AdminLogin" } } },
        },
        responses: {
          "204": {
            description: "Session cookie created",
            headers: { "Set-Cookie": { schema: { type: "string" } } },
          },
          "401": error,
          "429": { ...error, headers: { "Retry-After": { schema: { type: "integer" } } } },
        },
      },
    },
    "/api/v1/admin/sessions/current": {
      delete: {
        operationId: "deleteAdminSession",
        security: adminSecurity,
        responses: {
          "204": { description: "Session revoked and cookie cleared" },
          "401": error,
          "403": error,
        },
      },
    },
    "/api/v1/task-packs": {
      get: {
        operationId: "listPublishedTaskPacks",
        security: participantSecurity,
        parameters: [
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50 } },
          { name: "search", in: "query", schema: { type: "string", maxLength: 80 } },
          { name: "cursor", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": envelope({
            type: "array",
            items: { $ref: "#/components/schemas/PublicPackSummary" },
          }),
        },
      },
    },
    "/api/v1/task-packs/{packId}": {
      get: {
        operationId: "getPublishedTaskPack",
        security: participantSecurity,
        parameters: [packId],
        responses: {
          "200": envelope({ $ref: "#/components/schemas/PublicPackDetail" }),
          "404": error,
        },
      },
    },
    "/api/v1/admin/task-packs": {
      get: {
        operationId: "listAdminTaskPacks",
        security: adminSecurity,
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["draft", "published", "archived"] },
          },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 50 } },
          { name: "search", in: "query", schema: { type: "string", maxLength: 80 } },
          { name: "cursor", in: "query", schema: { type: "string" } },
          {
            name: "sort",
            in: "query",
            schema: { type: "string", enum: ["updated_desc", "name_asc"] },
          },
        ],
        responses: {
          "200": envelope({
            type: "array",
            items: { $ref: "#/components/schemas/AdminPackSummary" },
          }),
          "401": error,
        },
      },
      post: {
        operationId: "createTaskPack",
        security: adminSecurity,
        parameters: [idempotency],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/CreatePack" } } },
        },
        responses: {
          "201": envelope({ $ref: "#/components/schemas/AdminPack" }),
          "401": error,
          "403": error,
          "409": error,
          "422": error,
        },
      },
    },
    "/api/v1/admin/task-packs/{packId}": {
      get: {
        operationId: "getAdminTaskPack",
        security: adminSecurity,
        parameters: [packId],
        responses: {
          "200": envelope({ $ref: "#/components/schemas/AdminPack" }),
          "401": error,
          "404": error,
        },
      },
      patch: {
        operationId: "updateTaskPack",
        security: adminSecurity,
        parameters: [packId, idempotency],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: "#/components/schemas/UpdatePack" } } },
        },
        responses: {
          "200": envelope({ $ref: "#/components/schemas/AdminPack" }),
          "401": error,
          "403": error,
          "409": error,
          "422": error,
        },
      },
      delete: {
        operationId: "deleteTaskPack",
        security: adminSecurity,
        parameters: [packId, idempotency],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ExpectedRevision" } },
          },
        },
        responses: {
          "200": envelope({
            type: "object",
            required: ["deleted", "id"],
            properties: {
              deleted: { type: "boolean", const: true },
              id: { type: "string", format: "uuid" },
            },
          }),
          "401": error,
          "403": error,
          "404": error,
          "409": error,
        },
      },
    },
    "/api/v1/admin/task-packs/{packId}/publish": {
      post: {
        operationId: "publishTaskPack",
        security: adminSecurity,
        parameters: [packId, idempotency],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ExpectedRevision" } },
          },
        },
        responses: {
          "200": envelope({ $ref: "#/components/schemas/AdminPack" }),
          "409": error,
          "422": error,
        },
      },
    },
    "/api/v1/admin/task-packs/{packId}/archive": {
      post: {
        operationId: "archiveTaskPack",
        security: adminSecurity,
        parameters: [packId, idempotency],
        requestBody: {
          required: true,
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/ExpectedRevision" } },
          },
        },
        responses: {
          "200": envelope({ $ref: "#/components/schemas/AdminPack" }),
          "409": error,
          "422": error,
        },
      },
    },
  },
  components: {
    securitySchemes: {
      adminCookie: {
        type: "apiKey",
        in: "cookie",
        name: "__Host-admin_session",
        description: "Secure HttpOnly SameSite=Strict server-side administrator session",
      },
      participantBearer: { type: "http", scheme: "bearer", bearerFormat: "opaque" },
      participantCookie: { type: "apiKey", in: "cookie", name: "participant_session" },
    },
    schemas: {
      RoomMembershipInput: {
        type: "object",
        additionalProperties: false,
        required: ["nickname"],
        properties: { nickname: { type: "string", minLength: 1, maxLength: 24 } },
      },
      RoomCreationInput: {
        type: "object",
        additionalProperties: false,
        required: ["nickname"],
        properties: {
          nickname: { type: "string", minLength: 1, maxLength: 24 },
          minPlayers: { type: "integer", minimum: 3, maximum: 15, default: 3 },
          maxPlayers: { type: "integer", minimum: 3, maximum: 15, default: 12 },
        },
      },
      RoomSettingsInput: {
        type: "object",
        additionalProperties: false,
        minProperties: 1,
        properties: {
          selectedTaskPackId: { type: ["string", "null"], format: "uuid" },
          taskPhaseSeconds: { type: "integer", minimum: 300, maximum: 14400 },
          meetingsPerPlayer: { type: "integer", minimum: 0, maximum: 10 },
          meetingDurationSeconds: { type: "integer", minimum: 30, maximum: 1800 },
          meetingVotingMode: { type: "string", enum: ["timed", "all_voted"] },
          voteVisibility: { type: "string", enum: ["private", "public"] },
          evidenceVisibility: { type: "string", enum: ["private", "public"] },
          meetingTaskRequirement: { type: "string", enum: ["none", "one"] },
          meetingCooldownSeconds: { type: "integer", minimum: 10, maximum: 1800 },
          imposterCooldownSeconds: { type: "integer", minimum: 10, maximum: 300 },
          imposterCount: { type: "integer", minimum: 1, maximum: 7 },
          taskCounts: {
            type: "object",
            required: ["easy", "medium", "hard"],
            properties: {
              easy: { type: "integer", minimum: 0, maximum: 15 },
              medium: { type: "integer", minimum: 0, maximum: 15 },
              hard: { type: "integer", minimum: 0, maximum: 15 },
            },
          },
          roleCounts: {
            type: "object",
            additionalProperties: { type: "integer", minimum: 0, maximum: 15 },
          },
        },
      },
      ParticipantSelf: {
        type: "object",
        additionalProperties: false,
        required: ["participantId", "nickname", "isHost", "capabilities"],
        properties: {
          participantId: { type: "string", format: "uuid" },
          nickname: { type: "string" },
          isHost: { type: "boolean" },
          capabilities: { type: "array", items: { type: "string" } },
        },
      },
      RoomSnapshot: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "code",
          "status",
          "minPlayers",
          "maxPlayers",
          "settings",
          "participants",
          "self",
          "expiresAt",
          "gameId",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          code: { type: "string" },
          status: {
            type: "string",
            enum: ["lobby", "active", "completed", "abandoned", "expired"],
          },
          minPlayers: { type: "integer", minimum: 3, maximum: 15 },
          maxPlayers: { type: "integer", minimum: 3, maximum: 15 },
          settings: {
            type: "object",
            required: [
              "selectedTaskPack",
              "taskPhaseSeconds",
              "meetingsPerPlayer",
              "meetingDurationSeconds",
              "meetingVotingMode",
              "voteVisibility",
              "evidenceVisibility",
              "meetingTaskRequirement",
              "meetingCooldownSeconds",
              "imposterCooldownSeconds",
              "estimatedMeetingCooldownSeconds",
              "imposterCount",
              "allowedImposterCounts",
              "taskCounts",
              "roleCounts",
            ],
            properties: {
              selectedTaskPack: {
                oneOf: [
                  { type: "null" },
                  {
                    type: "object",
                    required: ["id", "name", "revision", "roles", "difficultyTaskCounts"],
                    properties: {
                      id: { type: "string", format: "uuid" },
                      name: { type: "string" },
                      revision: { type: "integer" },
                      roles: { type: "array", items: { $ref: "#/components/schemas/MapRole" } },
                      difficultyTaskCounts: {
                        type: "object",
                        required: ["easy", "medium", "hard"],
                        properties: {
                          easy: { type: "integer", minimum: 0 },
                          medium: { type: "integer", minimum: 0 },
                          hard: { type: "integer", minimum: 0 },
                        },
                      },
                    },
                  },
                ],
              },
              taskPhaseSeconds: { type: "integer" },
              meetingsPerPlayer: { type: "integer" },
              meetingDurationSeconds: { type: "integer" },
              meetingVotingMode: { type: "string", enum: ["timed", "all_voted"] },
              voteVisibility: { type: "string", enum: ["private", "public"] },
              evidenceVisibility: { type: "string", enum: ["private", "public"] },
              meetingTaskRequirement: { type: "string", enum: ["none", "one"] },
              meetingCooldownSeconds: { type: "integer" },
              imposterCooldownSeconds: { type: "integer" },
              estimatedMeetingCooldownSeconds: { type: "integer" },
              imposterCount: { type: "integer" },
              allowedImposterCounts: { type: "array", items: { type: "integer" } },
              taskCounts: { type: "object", additionalProperties: { type: "integer" } },
              roleCounts: { type: "object", additionalProperties: { type: "integer" } },
            },
          },
          participants: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "nickname", "isHost", "presence", "joinedAt"],
              properties: {
                id: { type: "string", format: "uuid" },
                nickname: { type: "string" },
                isHost: { type: "boolean" },
                presence: { type: "string", enum: ["connected", "away"] },
                joinedAt: { type: "string", format: "date-time" },
              },
            },
          },
          self: { $ref: "#/components/schemas/ParticipantSelf" },
          expiresAt: { type: "string", format: "date-time" },
          gameId: { type: ["string", "null"], format: "uuid" },
        },
      },
      EvidencePolicy: {
        type: "object",
        additionalProperties: false,
        required: ["version", "minimumAge", "retentionHours", "notice"],
        properties: {
          version: { type: "string" },
          minimumAge: { type: "integer", const: 18 },
          retentionHours: { type: "integer", const: 24 },
          notice: { type: "string" },
        },
      },
      UploadIntent: {
        type: "object",
        additionalProperties: false,
        required: ["uploadId", "expiresAt", "method", "url", "headers", "policy"],
        properties: {
          uploadId: { type: "string", format: "uuid" },
          expiresAt: { type: "string", format: "date-time" },
          method: { type: "string", const: "PUT" },
          url: { type: "string", format: "uri", writeOnly: true },
          headers: { type: "object", additionalProperties: { type: "string" }, writeOnly: true },
          policy: { $ref: "#/components/schemas/EvidencePolicy" },
        },
      },
      Submission: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "assignmentId",
          "uploader",
          "processingStatus",
          "reviewStatus",
          "createdAt",
          "image",
          "flaggedBySelf",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          assignmentId: { type: "string", format: "uuid" },
          uploader: {
            type: "object",
            required: ["id", "nickname"],
            properties: { id: { type: "string", format: "uuid" }, nickname: { type: "string" } },
          },
          processingStatus: {
            type: "string",
            enum: ["pending", "accepted", "rejected", "deleted"],
          },
          reviewStatus: { type: "string", enum: ["valid", "flagged", "invalid"] },
          createdAt: { type: "string", format: "date-time" },
          image: {
            oneOf: [
              { type: "null" },
              {
                type: "object",
                required: ["url", "expiresAt"],
                properties: {
                  url: { type: "string", format: "uri", writeOnly: true },
                  expiresAt: { type: "string", format: "date-time" },
                },
              },
            ],
          },
          flaggedBySelf: { type: "boolean" },
        },
      },
      SubmissionConfirmation: {
        type: "object",
        additionalProperties: false,
        required: ["submission", "assignmentStatus", "progress", "stateVersion"],
        properties: {
          submission: {
            type: "object",
            required: ["id", "assignmentId", "processingStatus", "reviewStatus", "createdAt"],
            properties: {
              id: { type: "string", format: "uuid" },
              assignmentId: { type: "string", format: "uuid" },
              processingStatus: { type: "string", const: "pending" },
              reviewStatus: { type: "string", const: "valid" },
              createdAt: { type: "string", format: "date-time" },
            },
          },
          assignmentStatus: { type: "string", const: "completed" },
          progress: {
            type: "object",
            required: ["percent"],
            properties: { percent: { type: "integer", minimum: 0, maximum: 100 } },
          },
          stateVersion: { type: "integer", minimum: 1 },
        },
      },
      GameSnapshot: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "roomId",
          "phase",
          "stateVersion",
          "winner",
          "endReason",
          "taskPack",
          "phaseStartedAt",
          "phaseDeadlineAt",
          "participants",
          "self",
          "assignments",
          "progress",
          "cooldowns",
          "meetingRules",
          "meeting",
          "resultSummary",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          roomId: { type: "string", format: "uuid" },
          phase: {
            type: "string",
            enum: ["task", "discussion", "review", "voting", "result", "game_over", "abandoned"],
          },
          stateVersion: { type: "integer", minimum: 1 },
          winner: { type: ["string", "null"], enum: ["crew", "imposters", null] },
          endReason: {
            type: ["string", "null"],
            enum: [
              "tasks_completed",
              "imposters_ejected",
              "imposter_parity",
              "time_expired",
              "abandoned",
              null,
            ],
          },
          taskPack: {
            type: "object",
            additionalProperties: false,
            required: ["name"],
            properties: { name: { type: "string" } },
          },
          phaseStartedAt: { type: "string", format: "date-time" },
          phaseDeadlineAt: { type: ["string", "null"], format: "date-time" },
          participants: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "nickname", "isHost", "lifeStatus"],
              properties: {
                id: { type: "string", format: "uuid" },
                nickname: { type: "string" },
                isHost: { type: "boolean" },
                lifeStatus: { type: "string", enum: ["alive", "killed", "ejected"] },
              },
            },
          },
          self: {
            type: "object",
            additionalProperties: false,
            required: [
              "participantId",
              "role",
              "lifeStatus",
              "capabilities",
              "killableParticipantIds",
              "knownEliminatedParticipantIds",
              "crewRole",
            ],
            properties: {
              participantId: { type: "string", format: "uuid" },
              role: { type: "string", enum: ["crew", "imposter"] },
              lifeStatus: { type: "string", enum: ["alive", "killed", "ejected"] },
              capabilities: { type: "array", items: { type: "string" } },
              killableParticipantIds: {
                type: "array",
                items: { type: "string", format: "uuid" },
              },
              knownEliminatedParticipantIds: {
                type: "array",
                items: { type: "string", format: "uuid" },
              },
              crewRole: { oneOf: [{ type: "null" }, { $ref: "#/components/schemas/MapRole" }] },
            },
          },
          assignments: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "description", "status", "completedAt", "difficulty"],
              properties: {
                id: { type: "string", format: "uuid" },
                description: { type: "string" },
                status: { type: "string", enum: ["assigned", "completed"] },
                completedAt: { type: ["string", "null"], format: "date-time" },
                difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
              },
            },
          },
          progress: {
            type: "object",
            additionalProperties: false,
            required: ["percent"],
            properties: { percent: { type: "integer", minimum: 0, maximum: 100 } },
          },
          cooldowns: {
            type: "object",
            additionalProperties: false,
            required: [
              "killAvailableAt",
              "meetingAvailableAt",
              "meetingCooldownSeconds",
              "killCooldownSeconds",
            ],
            properties: {
              killAvailableAt: { type: ["string", "null"], format: "date-time" },
              meetingAvailableAt: { type: ["string", "null"], format: "date-time" },
              meetingCooldownSeconds: { type: "integer", minimum: 0 },
              killCooldownSeconds: { type: "integer", minimum: 0 },
            },
          },
          meetingRules: {
            type: "object",
            additionalProperties: false,
            required: [
              "durationSeconds",
              "votingMode",
              "voteVisibility",
              "requiresCompletedTask",
              "maxPerPlayer",
              "calledBySelf",
              "remainingForSelf",
              "hasCompletedTask",
            ],
            properties: {
              durationSeconds: { type: "integer" },
              votingMode: { type: "string", enum: ["timed", "all_voted"] },
              voteVisibility: { type: "string", enum: ["private", "public"] },
              requiresCompletedTask: { type: "boolean" },
              maxPerPlayer: { type: "integer" },
              calledBySelf: { type: "integer" },
              remainingForSelf: { type: "integer" },
              hasCompletedTask: { type: "boolean" },
            },
          },
          meeting: { oneOf: [{ type: "null" }, { $ref: "#/components/schemas/Meeting" }] },
          resultSummary: { type: ["object", "null"], additionalProperties: true },
        },
      },
      Meeting: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "sequenceNumber",
          "triggerType",
          "reportedParticipantId",
          "phase",
          "deadlineAt",
          "eligibleParticipants",
          "reviewItem",
          "ownEjectionTargetParticipantId",
          "hasCastEjectionVote",
          "votesCast",
          "requiredVotes",
          "publicVotes",
          "result",
          "capabilities",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          sequenceNumber: { type: "integer", minimum: 1 },
          triggerType: { type: "string", enum: ["kill", "task_deadline", "user_called"] },
          reportedParticipantId: { type: ["string", "null"], format: "uuid" },
          phase: { type: "string", enum: ["discussion", "review", "voting", "resolved"] },
          deadlineAt: { type: ["string", "null"], format: "date-time" },
          eligibleParticipants: {
            type: "array",
            items: {
              type: "object",
              required: ["id", "nickname"],
              properties: { id: { type: "string", format: "uuid" }, nickname: { type: "string" } },
            },
          },
          reviewItem: { type: ["object", "null"], additionalProperties: true },
          ownEjectionTargetParticipantId: { type: ["string", "null"], format: "uuid" },
          hasCastEjectionVote: { type: "boolean" },
          votesCast: { type: "integer", minimum: 0 },
          requiredVotes: { type: "integer", minimum: 0 },
          publicVotes: {
            type: "array",
            items: {
              type: "object",
              required: [
                "voterParticipantId",
                "voterNickname",
                "targetParticipantId",
                "targetNickname",
              ],
              properties: {
                voterParticipantId: { type: "string", format: "uuid" },
                voterNickname: { type: "string" },
                targetParticipantId: { type: ["string", "null"], format: "uuid" },
                targetNickname: { type: ["string", "null"] },
              },
            },
          },
          result: { type: ["object", "null"], additionalProperties: true },
          capabilities: { type: "array", items: { type: "string" } },
        },
      },
      VoteAcknowledgement: {
        type: "object",
        additionalProperties: true,
        required: ["stateVersion", "votesCast"],
        properties: {
          stateVersion: { type: "integer", minimum: 1 },
          votesCast: { type: "integer", minimum: 0 },
          meetingId: { type: "string", format: "uuid" },
          targetParticipantId: { type: ["string", "null"], format: "uuid" },
          resolved: { type: "boolean" },
          winner: { type: ["string", "null"], enum: ["crew", "imposters", null] },
        },
      },
      SessionCredential: {
        type: "object",
        required: ["sessionExpiresAt"],
        properties: {
          sessionToken: { type: "string", writeOnly: true },
          sessionExpiresAt: { type: "string", format: "date-time" },
        },
      },
      SessionIssue: {
        type: "object",
        required: ["room", "participant", "sessionExpiresAt"],
        properties: {
          room: { $ref: "#/components/schemas/RoomSnapshot" },
          participant: { $ref: "#/components/schemas/ParticipantSelf" },
          sessionToken: { type: "string", writeOnly: true },
          sessionExpiresAt: { type: "string", format: "date-time" },
        },
      },
      Health: {
        type: "object",
        required: ["status"],
        properties: { status: { type: "string", const: "ok" } },
      },
      ErrorEnvelope: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message", "requestId"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: { type: "object", additionalProperties: true },
              requestId: { type: "string" },
            },
          },
        },
      },
      AdminLogin: {
        type: "object",
        additionalProperties: false,
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email", maxLength: 254 },
          password: { type: "string", minLength: 1, maxLength: 128, writeOnly: true },
        },
      },
      PackItemInput: {
        type: "object",
        additionalProperties: false,
        required: ["description"],
        properties: {
          description: { type: "string", minLength: 1, maxLength: 280 },
          isActive: { type: "boolean", default: true },
          difficulty: { type: "string", enum: ["easy", "medium", "hard"], default: "medium" },
        },
      },
      MapRole: {
        type: "object",
        additionalProperties: false,
        required: ["name", "specialization", "ability"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 50 },
          specialization: { type: "string", minLength: 1, maxLength: 160 },
          ability: { type: "string", minLength: 1, maxLength: 200 },
        },
      },
      PackItem: {
        allOf: [
          { $ref: "#/components/schemas/PackItemInput" },
          {
            type: "object",
            required: ["id", "position", "isActive"],
            properties: {
              id: { type: "string", format: "uuid" },
              position: { type: "integer", minimum: 1 },
              isActive: { type: "boolean" },
            },
          },
        ],
      },
      CreatePack: {
        type: "object",
        additionalProperties: false,
        required: ["name"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 80 },
          description: { type: ["string", "null"], maxLength: 1000 },
          items: {
            type: "array",
            maxItems: 15,
            items: {
              oneOf: [
                { type: "string", minLength: 1, maxLength: 280 },
                { $ref: "#/components/schemas/PackItemInput" },
              ],
            },
          },
          roles: { type: "array", maxItems: 12, items: { $ref: "#/components/schemas/MapRole" } },
        },
      },
      ExpectedRevision: {
        type: "object",
        additionalProperties: false,
        required: ["expectedRevision"],
        properties: { expectedRevision: { type: "integer", minimum: 1 } },
      },
      UpdatePack: {
        type: "object",
        additionalProperties: false,
        required: ["expectedRevision"],
        properties: {
          expectedRevision: { type: "integer", minimum: 1 },
          name: { type: "string", minLength: 1, maxLength: 80 },
          description: { type: ["string", "null"], maxLength: 1000 },
          items: {
            type: "array",
            maxItems: 15,
            items: {
              oneOf: [
                { type: "string", minLength: 1, maxLength: 280 },
                { $ref: "#/components/schemas/PackItemInput" },
              ],
            },
          },
          roles: { type: "array", maxItems: 12, items: { $ref: "#/components/schemas/MapRole" } },
        },
      },
      PublicPackSummary: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "name",
          "description",
          "activeTaskCount",
          "difficultyTaskCounts",
          "revision",
          "roles",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: ["string", "null"] },
          activeTaskCount: { type: "integer" },
          difficultyTaskCounts: {
            type: "object",
            required: ["easy", "medium", "hard"],
            properties: {
              easy: { type: "integer", minimum: 0 },
              medium: { type: "integer", minimum: 0 },
              hard: { type: "integer", minimum: 0 },
            },
          },
          revision: { type: "integer" },
          roles: { type: "array", items: { $ref: "#/components/schemas/MapRole" } },
        },
      },
      PublicPackDetail: {
        allOf: [
          { $ref: "#/components/schemas/PublicPackSummary" },
          {
            type: "object",
            required: ["items"],
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["position", "description", "difficulty"],
                  properties: {
                    position: { type: "integer" },
                    description: { type: "string" },
                    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                  },
                },
              },
            },
          },
        ],
      },
      AdminPackSummary: {
        type: "object",
        required: [
          "id",
          "slug",
          "name",
          "description",
          "status",
          "revision",
          "publishedAt",
          "createdAt",
          "updatedAt",
          "itemCount",
          "activeItemCount",
          "roles",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          slug: { type: "string" },
          name: { type: "string" },
          description: { type: ["string", "null"] },
          status: { type: "string", enum: ["draft", "published", "archived"] },
          revision: { type: "integer" },
          publishedAt: { type: ["string", "null"], format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          itemCount: { type: "integer" },
          activeItemCount: { type: "integer" },
          roles: { type: "array", items: { $ref: "#/components/schemas/MapRole" } },
        },
      },
      AdminPack: {
        type: "object",
        required: [
          "id",
          "slug",
          "name",
          "description",
          "status",
          "revision",
          "publishedAt",
          "createdAt",
          "updatedAt",
          "items",
          "roles",
        ],
        properties: {
          id: { type: "string", format: "uuid" },
          slug: { type: "string" },
          name: { type: "string" },
          description: { type: ["string", "null"] },
          status: { type: "string", enum: ["draft", "published", "archived"] },
          revision: { type: "integer" },
          publishedAt: { type: ["string", "null"], format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          roles: { type: "array", items: { $ref: "#/components/schemas/MapRole" } },
          items: { type: "array", items: { $ref: "#/components/schemas/PackItem" } },
        },
      },
    },
  },
};
