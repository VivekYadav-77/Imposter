import sharp from "sharp";

export type EvidenceContentType = "image/jpeg" | "image/png" | "image/webp";

export interface NormalizedEvidence {
  bytes: Uint8Array;
  contentType: "image/webp";
}

export async function normalizeEvidenceImage(input: {
  bytes: Uint8Array;
  declaredContentType: EvidenceContentType;
  maximumBytes: number;
  maximumPixels: number;
}): Promise<NormalizedEvidence> {
  if (input.bytes.byteLength === 0 || input.bytes.byteLength > input.maximumBytes)
    throw new Error("IMAGE_TOO_LARGE");
  const image = sharp(input.bytes, {
    limitInputPixels: input.maximumPixels,
    sequentialRead: true,
    failOn: "warning",
  });
  const metadata = await image.metadata();
  const detected: EvidenceContentType | null =
    metadata.format === "jpeg"
      ? "image/jpeg"
      : metadata.format === "png"
        ? "image/png"
        : metadata.format === "webp"
          ? "image/webp"
          : null;
  if (!detected || detected !== input.declaredContentType || (metadata.pages ?? 1) !== 1)
    throw new Error("IMAGE_TYPE_INVALID");
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > input.maximumPixels)
    throw new Error("IMAGE_DIMENSIONS_INVALID");
  return {
    bytes: await image.rotate().webp({ quality: 82, effort: 4 }).toBuffer(),
    contentType: "image/webp",
  };
}
