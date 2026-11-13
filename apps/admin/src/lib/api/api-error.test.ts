import { describe, expect, it } from 'vitest';

import { ApiError, isApiError, normalizeError } from './api-error';

// Build minimal axios-error-shaped fixtures. axios.isAxiosError() only checks
// `isAxiosError === true`, so a plain object is enough (folder 07 lesson).
function axiosLike(fields: Record<string, unknown>): unknown {
  return { isAxiosError: true, message: 'axios message', ...fields };
}

describe('normalizeError', () => {
  it('returns an already-normalized ApiError unchanged', () => {
    const original = new ApiError({ kind: 'http', message: 'x', status: 500 });
    expect(normalizeError(original)).toBe(original);
  });

  it('maps a canceled request', () => {
    expect(normalizeError(axiosLike({ code: 'ERR_CANCELED' })).kind).toBe('canceled');
  });

  it('maps a timeout', () => {
    expect(normalizeError(axiosLike({ code: 'ECONNABORTED' })).kind).toBe('timeout');
    expect(normalizeError(axiosLike({ code: 'ETIMEDOUT' })).kind).toBe('timeout');
  });

  it('maps a no-response failure to network', () => {
    expect(normalizeError(axiosLike({ response: undefined })).kind).toBe('network');
  });

  it('maps an HTTP error with status, code and body message', () => {
    const result = normalizeError(
      axiosLike({ response: { status: 404, data: { message: 'Not found', code: 'NOT_FOUND' } } }),
    );
    expect(result.kind).toBe('http');
    expect(result.status).toBe(404);
    expect(result.code).toBe('NOT_FOUND');
    expect(result.message).toBe('Not found');
  });

  it('maps a plain Error to unknown', () => {
    const result = normalizeError(new Error('boom'));
    expect(result.kind).toBe('unknown');
    expect(result.message).toBe('boom');
  });

  it('maps a non-error value to unknown', () => {
    expect(normalizeError('weird').kind).toBe('unknown');
  });
});

describe('ApiError', () => {
  it('isApiError narrows correctly', () => {
    expect(isApiError(new ApiError({ kind: 'network', message: 'x' }))).toBe(true);
    expect(isApiError(new Error('x'))).toBe(false);
  });

  it('exposes kind/status getters', () => {
    expect(new ApiError({ kind: 'network', message: 'x' }).isNetwork).toBe(true);
    expect(new ApiError({ kind: 'timeout', message: 'x' }).isTimeout).toBe(true);
    expect(new ApiError({ kind: 'http', message: 'x', status: 401 }).isAuthError).toBe(true);
    expect(new ApiError({ kind: 'http', message: 'x', status: 403 }).isAuthError).toBe(true);
    expect(new ApiError({ kind: 'http', message: 'x', status: 500 }).isAuthError).toBe(false);
  });
});
