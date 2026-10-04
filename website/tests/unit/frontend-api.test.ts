import { afterEach, describe, expect, it, vi } from "vitest";

import { createIdempotencyKey, participantApi } from "../../src/client/api/client.js";
import type { ApiError } from "../../src/client/api/client.js";

const ok = (data: unknown, status = 200) =>
  new Response(
    status === 204
      ? null
      : JSON.stringify({
          data,
          meta: { requestId: "req-test", serverTime: "2026-01-01T00:00:00.000Z" },
        }),
    { status, headers: { "Content-Type": "application/json" } },
  );

afterEach(() => vi.unstubAllGlobals());

describe("frontend HTTP boundary", () => {
  it("creates stable, valid idempotency keys", () => {
    const first = createIdempotencyKey();
    expect(first.length).toBeGreaterThanOrEqual(8);
    expect(createIdempotencyKey()).not.toBe(first);
  });

  it("requests secure cookie transport without exposing a token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(ok({ room: {}, participant: {}, sessionExpiresAt: "soon" }, 201));
    vi.stubGlobal("fetch", fetchMock);
    await participantApi.createRoom("Ada", "stable-key");
    const [path, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(path).toBe("/api/v1/rooms");
    expect(init.credentials).toBe("same-origin");
    expect(headers.get("X-Session-Transport")).toBe("cookie");
    expect(headers.get("Idempotency-Key")).toBe("stable-key");
    expect(typeof init.body).toBe("string");
    const body = init.body as string;
    expect(JSON.parse(body)).toEqual({ nickname: "Ada" });
    expect(body).not.toContain("token");
  });

  it("sends explicit avatar choices and reads join availability", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ room: {}, participant: {}, sessionExpiresAt: "soon" }, 201))
      .mockResolvedValueOnce(ok({ availableAvatarIds: ["owl"], spotsRemaining: 1 }));
    vi.stubGlobal("fetch", fetchMock);
    await participantApi.createRoom("Ada", 3, 12, "avatar-create", "fox");
    const createCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(createCall[1].body as string)).toMatchObject({
      avatarId: "fox",
    });
    const options = await participantApi.joinOptions("ABC123");
    const optionsCall = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(optionsCall[0]).toBe("/api/v1/rooms/ABC123/join-options");
    expect(options.data.availableAvatarIds).toEqual(["owl"]);
  });

  it("maps safe server errors with request IDs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: "VALIDATION_FAILED",
              message: "Check the submitted fields.",
              requestId: "req-7",
            },
          }),
          { status: 422, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    await expect(participantApi.joinRoom("ABC123", "Ada", "stable-key")).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_FAILED",
      requestId: "req-7",
      retryable: false,
    } satisfies Partial<ApiError>);
  });
});
