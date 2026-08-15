import type { OpenAPIObject } from "openapi3-ts/oas31";

const metaSchema = {
  type: "object" as const,
  required: ["requestId", "serverTime"],
  properties: {
    requestId: { type: "string" as const },
    serverTime: { type: "string" as const, format: "date-time" },
  },
};

const healthResponse = {
  description: "Health status",
  content: {
    "application/json": {
      schema: {
        type: "object" as const,
        required: ["data", "meta"],
        properties: {
          data: {
            type: "object" as const,
            required: ["status"],
            properties: { status: { type: "string" as const, enum: ["ok"] } },
          },
          meta: metaSchema,
        },
      },
    },
  },
};

export const openApiDocument: OpenAPIObject = {
  openapi: "3.1.0",
  info: {
    title: "Imposter Game API",
    version: "0.1.0",
    description: "Versioned HTTP contract for web and native clients.",
  },
  servers: [{ url: "/" }],
  paths: {
    "/health/live": {
      get: { operationId: "getLiveness", responses: { "200": healthResponse } },
    },
    "/health/ready": {
      get: {
        operationId: "getReadiness",
        responses: {
          "200": healthResponse,
          "503": { $ref: "#/components/responses/DependencyUnavailable" },
        },
      },
    },
    "/api/v1": {
      get: {
        operationId: "getApiVersion",
        responses: {
          "200": {
            description: "API version information",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["data", "meta"],
                  properties: {
                    data: {
                      type: "object",
                      required: ["version"],
                      properties: { version: { type: "string", const: "v1" } },
                    },
                    meta: metaSchema,
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    responses: {
      DependencyUnavailable: {
        description: "A required dependency is unavailable",
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ErrorEnvelope" },
          },
        },
      },
    },
    schemas: {
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
    },
  },
};
