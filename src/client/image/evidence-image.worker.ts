/// <reference lib="webworker" />

import {
  EVIDENCE_MAX_EDGE,
  EVIDENCE_MAX_UPLOAD_BYTES,
  EVIDENCE_TARGET_BYTES,
  evidenceImageName,
  fitEvidenceImage,
  isEvidenceImageContentType,
  type EvidenceImageContentType,
} from "./evidence-image-policy";

type NormalizeRequest = { id: string; file: File };
type NormalizeSuccess = {
  id: string;
  ok: true;
  unchanged: boolean;
  bytes?: ArrayBuffer;
  contentType?: EvidenceImageContentType;
  name?: string;
};
type NormalizeFailure = { id: string; ok: false; code: string };

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
const qualitySteps = [0.86, 0.78, 0.7, 0.62, 0.54];
const edgeSteps = [1, 0.85, 0.7, 0.58, 0.48];

async function decode(file: File) {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return createImageBitmap(file);
  }
}

async function encode(
  canvas: OffscreenCanvas,
  contentType: "image/webp" | "image/jpeg",
  quality: number,
) {
  try {
    const blob = await canvas.convertToBlob({ type: contentType, quality });
    return blob.type === contentType ? blob : null;
  } catch {
    return null;
  }
}

async function normalize(file: File): Promise<Omit<NormalizeSuccess, "id" | "ok">> {
  if (!isEvidenceImageContentType(file.type)) throw new Error("UNSUPPORTED_IMAGE_TYPE");
  if (file.size === 0) throw new Error("EMPTY_IMAGE");

  let bitmap: ImageBitmap;
  try {
    bitmap = await decode(file);
  } catch {
    throw new Error("IMAGE_DECODE_FAILED");
  }

  try {
    if (
      file.size <= EVIDENCE_TARGET_BYTES &&
      bitmap.width <= EVIDENCE_MAX_EDGE &&
      bitmap.height <= EVIDENCE_MAX_EDGE
    ) {
      return { unchanged: true };
    }

    if (typeof OffscreenCanvas === "undefined") throw new Error("IMAGE_PROCESSING_UNAVAILABLE");

    const fitted = fitEvidenceImage(bitmap.width, bitmap.height);
    let smallest: Blob | null = null;

    for (const edgeScale of edgeSteps) {
      const width = Math.max(1, Math.round(fitted.width * edgeScale));
      const height = Math.max(1, Math.round(fitted.height * edgeScale));
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("IMAGE_PROCESSING_UNAVAILABLE");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);

      for (const quality of qualitySteps) {
        const blob =
          (await encode(canvas, "image/webp", quality)) ??
          (await encode(canvas, "image/jpeg", quality));
        if (!blob) throw new Error("IMAGE_PROCESSING_UNAVAILABLE");
        if (!smallest || blob.size < smallest.size) smallest = blob;
        if (blob.size <= EVIDENCE_TARGET_BYTES) {
          const contentType = blob.type as EvidenceImageContentType;
          return {
            unchanged: false,
            bytes: await blob.arrayBuffer(),
            contentType,
            name: evidenceImageName(file.name, contentType),
          };
        }
      }
    }

    if (smallest && smallest.size <= EVIDENCE_MAX_UPLOAD_BYTES) {
      const contentType = smallest.type as EvidenceImageContentType;
      return {
        unchanged: false,
        bytes: await smallest.arrayBuffer(),
        contentType,
        name: evidenceImageName(file.name, contentType),
      };
    }
    throw new Error("IMAGE_TOO_LARGE_AFTER_COMPRESSION");
  } finally {
    bitmap.close();
  }
}

workerScope.onmessage = async (event: MessageEvent<NormalizeRequest>) => {
  const { id, file } = event.data;
  try {
    const result = await normalize(file);
    const response: NormalizeSuccess = { id, ok: true, ...result };
    workerScope.postMessage(response, response.bytes ? [response.bytes] : []);
  } catch (cause) {
    const response: NormalizeFailure = {
      id,
      ok: false,
      code: cause instanceof Error ? cause.message : "IMAGE_PROCESSING_FAILED",
    };
    workerScope.postMessage(response);
  }
};

export {};
