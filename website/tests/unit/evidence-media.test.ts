import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { normalizeEvidenceImage } from "../../src/modules/evidence/media.js";

describe("evidence image security", () => {
  it.each([
    ["image/jpeg" as const, "jpeg" as const],
    ["image/png" as const, "png" as const],
    ["image/webp" as const, "webp" as const],
  ])("accepts and normalizes %s without metadata", async (contentType, format) => {
    const source = await sharp({
      create: { width: 32, height: 24, channels: 3, background: "red" },
    })
      .withMetadata({ orientation: 6 })
      .toFormat(format)
      .toBuffer();
    const result = await normalizeEvidenceImage({
      bytes: source,
      declaredContentType: contentType,
      maximumBytes: 5 * 1024 * 1024,
      maximumPixels: 20_000_000,
    });
    const metadata = await sharp(result.bytes).metadata();
    expect(result.contentType).toBe("image/webp");
    expect(metadata.format).toBe("webp");
    expect(metadata.exif).toBeUndefined();
    expect(metadata.icc).toBeUndefined();
  });

  it("rejects a spoofed declared MIME type", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "blue" },
    })
      .png()
      .toBuffer();
    await expect(
      normalizeEvidenceImage({
        bytes: png,
        declaredContentType: "image/jpeg",
        maximumBytes: 1024 * 1024,
        maximumPixels: 100,
      }),
    ).rejects.toThrow("IMAGE_TYPE_INVALID");
  });

  it("rejects oversized, corrupt, and decompression-limit fixtures", async () => {
    await expect(
      normalizeEvidenceImage({
        bytes: new Uint8Array(101),
        declaredContentType: "image/png",
        maximumBytes: 100,
        maximumPixels: 100,
      }),
    ).rejects.toThrow("IMAGE_TOO_LARGE");
    await expect(
      normalizeEvidenceImage({
        bytes: new TextEncoder().encode("not an image"),
        declaredContentType: "image/png",
        maximumBytes: 100,
        maximumPixels: 100,
      }),
    ).rejects.toThrow();
    const large = await sharp({
      create: { width: 20, height: 20, channels: 3, background: "green" },
    })
      .png()
      .toBuffer();
    await expect(
      normalizeEvidenceImage({
        bytes: large,
        declaredContentType: "image/png",
        maximumBytes: 1024 * 1024,
        maximumPixels: 100,
      }),
    ).rejects.toThrow();
  });
});
