import type { UploadIntent } from "../api/types";

const retryableUploadStatus = (status: number) =>
  status === 408 || status === 425 || status === 429 || status >= 500;

const waitForRetry = (signal: AbortSignal | undefined, milliseconds: number) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Upload cancelled.", "AbortError"));
      return;
    }
    const abort = () => {
      globalThis.clearTimeout(timer);
      reject(new DOMException("Upload cancelled.", "AbortError"));
    };
    const timer = globalThis.setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", abort, { once: true });
  });

export async function uploadEvidenceObject(
  intent: UploadIntent,
  file: File,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
) {
  const maximumAttempts = 4;
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    let response: Response | undefined;
    try {
      response = await fetcher(intent.url, {
        method: intent.method,
        headers: intent.headers,
        body: file,
        signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      if (attempt === maximumAttempts - 1) throw error;
    }
    if (response?.ok) return;
    if (response && (!retryableUploadStatus(response.status) || attempt === maximumAttempts - 1))
      throw new Error("Storage upload failed");
    const retryAfter = response?.headers.get("Retry-After");
    const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : Number.NaN;
    const delay = Number.isFinite(retryAfterMs)
      ? Math.min(5_000, Math.max(100, retryAfterMs))
      : 300 * 2 ** attempt + Math.random() * 100;
    await waitForRetry(signal, delay);
  }
}
