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
  for (let attempt = 0; attempt < 2; attempt += 1) {
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
      if (attempt === 1) throw error;
    }
    if (response?.ok) return;
    if (response && (!retryableUploadStatus(response.status) || attempt === 1))
      throw new Error("Storage upload failed");
    await waitForRetry(signal, 300);
  }
}
