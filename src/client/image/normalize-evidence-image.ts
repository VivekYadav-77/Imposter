import {
  EVIDENCE_MAX_UPLOAD_BYTES,
  isEvidenceImageContentType,
  type EvidenceImageContentType,
} from "./evidence-image-policy";

type WorkerResponse =
  | { id: string; ok: true; unchanged: true }
  | {
      id: string;
      ok: true;
      unchanged: false;
      bytes: ArrayBuffer;
      contentType: EvidenceImageContentType;
      name: string;
    }
  | { id: string; ok: false; code: string };

export class EvidenceImageError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "EvidenceImageError";
  }
}

export function evidenceImageErrorMessage(error: unknown) {
  if (!(error instanceof EvidenceImageError))
    return "The photo could not be prepared. Try another image.";
  if (error.code === "UNSUPPORTED_IMAGE_TYPE") return "Choose a JPEG, PNG, or WebP photo.";
  if (error.code === "EMPTY_IMAGE") return "The selected photo is empty. Choose another image.";
  if (error.code === "IMAGE_DECODE_FAILED")
    return "This photo could not be read. Try taking a new photo or choose a JPEG image.";
  if (error.code === "IMAGE_TOO_LARGE_AFTER_COMPRESSION")
    return "This photo is too large to optimize. Try taking it again at a lower resolution.";
  if (error.code === "IMAGE_PROCESSING_UNAVAILABLE")
    return "This browser cannot optimize large photos. Try updating it or take a lower-resolution photo.";
  return "The photo could not be prepared. Try another image.";
}

export function normalizeEvidenceImage(file: File, signal?: AbortSignal): Promise<File> {
  if (!isEvidenceImageContentType(file.type))
    return Promise.reject(new EvidenceImageError("UNSUPPORTED_IMAGE_TYPE"));
  if (file.size === 0) return Promise.reject(new EvidenceImageError("EMPTY_IMAGE"));
  if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));

  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./evidence-image.worker.ts", import.meta.url), {
      type: "module",
      name: "evidence-image-normalizer",
    });
    const id = crypto.randomUUID();
    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      callback();
    };
    const abort = () =>
      finish(() => reject(new DOMException("Photo preparation was cancelled.", "AbortError")));

    signal?.addEventListener("abort", abort, { once: true });
    worker.onerror = () => finish(() => reject(new EvidenceImageError("IMAGE_PROCESSING_FAILED")));
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      if (response.id !== id) return;
      if (!response.ok) {
        finish(() => reject(new EvidenceImageError(response.code)));
        return;
      }
      if (response.unchanged) {
        if (file.size > EVIDENCE_MAX_UPLOAD_BYTES) {
          finish(() => reject(new EvidenceImageError("IMAGE_TOO_LARGE_AFTER_COMPRESSION")));
        } else finish(() => resolve(file));
        return;
      }
      const normalized = new File([response.bytes], response.name, {
        type: response.contentType,
        lastModified: file.lastModified,
      });
      if (normalized.size > EVIDENCE_MAX_UPLOAD_BYTES) {
        finish(() => reject(new EvidenceImageError("IMAGE_TOO_LARGE_AFTER_COMPRESSION")));
      } else finish(() => resolve(normalized));
    };
    worker.postMessage({ id, file });
  });
}
