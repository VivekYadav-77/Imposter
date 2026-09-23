export const EVIDENCE_MAX_UPLOAD_BYTES = 5_242_880;
export const EVIDENCE_TARGET_BYTES = 2_000_000;
export const EVIDENCE_MAX_EDGE = 2_048;

export const EVIDENCE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type EvidenceImageContentType = (typeof EVIDENCE_CONTENT_TYPES)[number];

export function isEvidenceImageContentType(value: string): value is EvidenceImageContentType {
  return EVIDENCE_CONTENT_TYPES.some((contentType) => contentType === value);
}

export function fitEvidenceImage(width: number, height: number, maximumEdge = EVIDENCE_MAX_EDGE) {
  const scale = Math.min(1, maximumEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function evidenceImageName(originalName: string, contentType: EvidenceImageContentType) {
  const base = originalName.replace(/\.[^.]+$/, "").trim() || "evidence";
  const extension =
    contentType === "image/webp" ? "webp" : contentType === "image/png" ? "png" : "jpg";
  return `${base}.${extension}`;
}
