import { afterEach, describe, expect, it, vi } from "vitest";

import type { UploadIntent } from "../../src/client/api/types";
import { uploadEvidenceObject } from "../../src/client/image/upload-evidence-object";

const intent: UploadIntent = {
  uploadId: "00000000-0000-4000-8000-000000000001",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  method: "PUT",
  url: "/api/v1/evidence-objects/capability",
  headers: { "content-type": "image/jpeg" },
  policy: {
    version: "test",
    notice: "test",
    minimumAge: 18,
    retentionHours: 24,
  },
};

describe("evidence object upload", () => {
  afterEach(() => vi.useRealTimers());

  it("retries a transient failure using the same upload capability", async () => {
    vi.useFakeTimers();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("connection lost"))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const upload = uploadEvidenceObject(
      intent,
      new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
      undefined,
      fetcher,
    );

    await vi.advanceTimersByTimeAsync(300);
    await expect(upload).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0][0]).toBe(intent.url);
    expect(fetcher.mock.calls[1][0]).toBe(intent.url);
  });

  it("does not retry a permanent storage rejection", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 422 }));

    await expect(
      uploadEvidenceObject(
        intent,
        new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
        undefined,
        fetcher,
      ),
    ).rejects.toThrow("Storage upload failed");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("stops retrying when the dialog cancels the upload", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException("Aborted", "AbortError"));

    await expect(
      uploadEvidenceObject(
        intent,
        new File(["photo"], "photo.jpg", { type: "image/jpeg" }),
        controller.signal,
        fetcher,
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
