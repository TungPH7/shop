import { type AxiosError } from 'axios';

// Pure retry policy — no side effects, so it is trivially unit-testable.

/** Total attempts = 1 (original) + MAX_RETRIES. */
export const MAX_RETRIES = 2;

// 408 Request Timeout, 429 Too Many Requests, and 5xx are transient.
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

// Only retry methods that are safe to repeat. Retrying a POST could create
// duplicates; GET/HEAD/OPTIONS/PUT/DELETE are idempotent by HTTP semantics.
const IDEMPOTENT_METHODS = new Set(['get', 'head', 'options', 'put', 'delete']);

export function isRetryableError(error: AxiosError, method: string | undefined): boolean {
  if (!method || !IDEMPOTENT_METHODS.has(method.toLowerCase())) {
    return false;
  }
  // A user-canceled request must never be retried.
  if (error.code === 'ERR_CANCELED') {
    return false;
  }
  // No response → network/timeout failure → worth retrying.
  if (!error.response) {
    return true;
  }
  return RETRYABLE_STATUSES.has(error.response.status);
}

/**
 * Exponential backoff with full jitter. If the server sent `Retry-After`
 * (seconds or an HTTP date), that wins — the server knows best.
 *
 * @param attempt zero-based retry index (0 for the first retry).
 */
export function getRetryDelayMs(attempt: number, retryAfterHeader?: string | null): number {
  const serverDelay = parseRetryAfter(retryAfterHeader);
  if (serverDelay !== null) {
    return serverDelay;
  }

  const baseMs = 300;
  const capMs = 5000;
  const exponential = Math.min(capMs, baseMs * 2 ** attempt);
  // Full jitter (random in [0, exponential]) spreads retries out and avoids a
  // thundering herd of clients all retrying at the same instant.
  return Math.round(Math.random() * exponential);
}

function parseRetryAfter(header?: string | null): number | null {
  if (!header) {
    return null;
  }
  const asSeconds = Number(header);
  if (!Number.isNaN(asSeconds)) {
    return asSeconds * 1000;
  }
  const asDateMs = Date.parse(header);
  if (!Number.isNaN(asDateMs)) {
    return Math.max(0, asDateMs - Date.now());
  }
  return null;
}
