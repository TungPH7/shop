import axios, { type AxiosError } from 'axios';

// A single, normalized error shape for the whole app. Features and the UI catch
// `ApiError` and never touch raw Axios internals — the transport library stays
// an implementation detail behind this boundary.

export type ApiErrorKind =
  | 'network' // no response (offline, DNS, CORS, connection refused)
  | 'timeout' // request aborted by the configured timeout
  | 'canceled' // request aborted via AbortController
  | 'validation' // response body failed schema validation at the boundary
  | 'http' // server responded with a non-2xx status
  | 'unknown';

export interface ApiErrorOptions {
  kind: ApiErrorKind;
  message: string;
  /** HTTP status, set when `kind === 'http'`. */
  status?: number | undefined;
  /** Business/error code from the response body, when the backend sends one. */
  code?: string | undefined;
  /** Raw server payload or Zod issues — for logging/debugging, not for UI copy. */
  details?: unknown;
  /** The original error that was normalized. */
  cause?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly details: unknown;

  constructor(options: ApiErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = 'ApiError';
    this.kind = options.kind;
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }

  get isNetwork(): boolean {
    return this.kind === 'network';
  }

  get isTimeout(): boolean {
    return this.kind === 'timeout';
  }

  /** 401/403 — caller may redirect to login or show a "no access" screen. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** Shape we read defensively from an error response body. */
interface ServerErrorBody {
  message?: string;
  code?: string;
}

/**
 * Convert ANY thrown value (Axios error, ApiError, or anything else) into a
 * single normalized `ApiError`. This is the heart of "normalize errors at the
 * boundary": callers downstream branch on `kind`/`status`, never on Axios codes.
 */
export function normalizeError(error: unknown): ApiError {
  // Already normalized (e.g. a validation error thrown by the client).
  if (isApiError(error)) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<ServerErrorBody>;

    if (axiosError.code === 'ERR_CANCELED') {
      return new ApiError({ kind: 'canceled', message: 'Request was canceled', cause: error });
    }
    if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
      return new ApiError({ kind: 'timeout', message: 'Request timed out', cause: error });
    }

    const response = axiosError.response;
    if (!response) {
      // Request was made but no response arrived → network-level failure.
      return new ApiError({
        kind: 'network',
        message: 'Network error — could not reach the server',
        cause: error,
      });
    }

    const body = response.data;
    return new ApiError({
      kind: 'http',
      status: response.status,
      code: body?.code,
      message:
        body?.message ?? axiosError.message ?? `Request failed with status ${response.status}`,
      details: body,
      cause: error,
    });
  }

  if (error instanceof Error) {
    return new ApiError({ kind: 'unknown', message: error.message, cause: error });
  }
  return new ApiError({ kind: 'unknown', message: 'Unexpected error', cause: error });
}
