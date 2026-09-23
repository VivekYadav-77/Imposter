import { describe, expect, it } from "vitest";
import {
  EVIDENCE_MAX_EDGE,
  evidenceImageName,
  fitEvidenceImage,
  isEvidenceImageContentType,
} from "../../src/client/image/evidence-image-policy";

describe("client evidence image policy", () => {
  it("fits modern high-resolution photos inside the evidence dimensions", () => {
    expect(fitEvidenceImage(8_064, 6_048)).toEqual({ width: EVIDENCE_MAX_EDGE, height: 1_536 });
    expect(fitEvidenceImage(3_024, 4_032)).toEqual({ width: 1_536, height: EVIDENCE_MAX_EDGE });
  });

  it("does not upscale an already-small photo", () => {
    expect(fitEvidenceImage(1_200, 800)).toEqual({ width: 1_200, height: 800 });
  });

  it("accepts only formats understood by the evidence API", () => {
    expect(isEvidenceImageContentType("image/jpeg")).toBe(true);
    expect(isEvidenceImageContentType("image/png")).toBe(true);
    expect(isEvidenceImageContentType("image/webp")).toBe(true);
    expect(isEvidenceImageContentType("image/heic")).toBe(false);
  });

  it("uses an extension that matches the normalized MIME type", () => {
    expect(evidenceImageName("camera.photo.jpeg", "image/webp")).toBe("camera.photo.webp");
    expect(evidenceImageName("", "image/jpeg")).toBe("evidence.jpg");
  });
});
