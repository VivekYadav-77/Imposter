export interface ResponseMeta {
  requestId: string;
  serverTime: string;
  nextCursor?: string | null;
}

export interface SuccessEnvelope<T> {
  data: T;
  meta: ResponseMeta;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    requestId: string;
  };
}

export function successEnvelope<T>(
  data: T,
  requestId: string,
  nextCursor?: string | null,
): SuccessEnvelope<T> {
  return {
    data,
    meta: {
      requestId,
      serverTime: new Date().toISOString(),
      ...(nextCursor !== undefined ? { nextCursor } : {}),
    },
  };
}
