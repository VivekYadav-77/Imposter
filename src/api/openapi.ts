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
    version: "0.2.0",
    description: "Versioned HTTP contract for web and native clients.",
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
        },
      },
      PublicPackSummary: {
        type: "object",
        additionalProperties: false,
        required: ["id", "name", "description", "activeTaskCount", "revision"],
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          description: { type: ["string", "null"] },
          activeTaskCount: { type: "integer" },
          revision: { type: "integer" },
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
                  required: ["position", "description"],
                  properties: { position: { type: "integer" }, description: { type: "string" } },
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
          items: { type: "array", items: { $ref: "#/components/schemas/PackItem" } },
        },
      },
    },
  },
};
