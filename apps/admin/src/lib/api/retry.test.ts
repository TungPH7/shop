import { type AxiosError, type AxiosResponse } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getRetryDelayMs, isRetryableError, MAX_RETRIES } from './retry';

function axiosError(opts: { code?: string; status?: number }): AxiosError {
  return {
    code: opts.code,
    response: opts.status === undefined ? undefined : ({ status: opts.status } as AxiosResponse),
    isAxiosError: true,
  } as AxiosError;
}

describe('isRetryableError', () => {
  it('retries idempotent methods on transient statuses', () => {
    for (const status of [408, 429, 500, 502, 503, 504]) {
      expect(isRetryableError(axiosError({ status }), 'get')).toBe(true);
    }
  });

  it('does not retry non-transient statuses', () => {
    expect(isRetryableError(axiosError({ status: 404 }), 'get')).toBe(false);
    expect(isRetryableError(axiosError({ status: 400 }), 'get')).toBe(false);
  });

  it('retries a no-response (network) failure', () => {
    expect(isRetryableError(axiosError({}), 'get')).toBe(true);
  });

  it('never retries non-idempotent methods or a missing method', () => {
    expect(isRetryableError(axiosError({ status: 500 }), 'post')).toBe(false);
    expect(isRetryableError(axiosError({ status: 500 }), undefined)).toBe(false);
  });

  it('never retries a canceled request', () => {
    expect(isRetryableError(axiosError({ code: 'ERR_CANCELED', status: 500 }), 'get')).toBe(false);
  });
});

describe('getRetryDelayMs', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('honors a numeric Retry-After (seconds → ms)', () => {
    expect(getRetryDelayMs(0, '2')).toBe(2000);
    expect(getRetryDelayMs(5, '120')).toBe(120_000); // header wins over backoff
  });

  it('falls back to exponential backoff with full jitter', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(getRetryDelayMs(0)).toBe(150); // round(0.5 * min(5000, 300*2^0=300))
    expect(getRetryDelayMs(1)).toBe(300); // round(0.5 * 600)
  });

  it('caps the exponential term', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);
    expect(getRetryDelayMs(10)).toBe(5000); // 300*2^10 capped to 5000
  });

  it('ignores an unparseable Retry-After and uses backoff', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(getRetryDelayMs(0, 'not-a-date')).toBe(0);
  });

  it('MAX_RETRIES is 2', () => {
    expect(MAX_RETRIES).toBe(2);
  });
});
