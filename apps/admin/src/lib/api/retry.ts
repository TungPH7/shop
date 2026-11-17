import { type AxiosError } from 'axios';

// Pure retry policy — no side effects, so it is trivially unit-testable.

/** Total attempts = 1 (original) + MAX_RETRIES. */
export const MAX_RETRIES = 2;

// 408 Request Timeout, 429 Too Many Requests, and 5xx are transient.
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

// Only reads are retried, never a write (NFR19 of docs/specs/SHOP-7/spec.md; plan,
// Architecture Decisions 13). A POST sent twice could add the product twice. A PUT
// or DELETE is idempotent, but the retry of one that succeeded and lost its answer
// gets a false 409 (version moved on) or a false 404: the form or the dialog shows a
// failure for a write that happened. The person tries again instead, and the DELETE
// of the API answers 204 even for a product already gone.
const READ_METHODS = new Set(['get', 'head', 'options']);

export function isRetryableError(error: AxiosError, method: string | undefined): boolean {
  if (!method || !READ_METHODS.has(method.toLowerCase())) {
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
