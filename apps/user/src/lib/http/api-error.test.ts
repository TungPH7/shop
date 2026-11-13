import { expect, test } from 'vitest';

import { ApiError, isApiError } from './api-error';

test('ApiError giữ kind/status/message + isApiError nhận diện', () => {
  const err = new ApiError({ kind: 'http', status: 404, message: 'Not found' });
  expect(isApiError(err)).toBe(true);
  expect(err.kind).toBe('http');
  expect(err.status).toBe(404);
  expect(err.name).toBe('ApiError');
  expect(err.message).toBe('Not found');
});

test('isAuthError đúng cho 401/403, sai cho status khác', () => {
  expect(new ApiError({ kind: 'http', status: 401, message: '' }).isAuthError).toBe(true);
  expect(new ApiError({ kind: 'http', status: 403, message: '' }).isAuthError).toBe(true);
  expect(new ApiError({ kind: 'http', status: 500, message: '' }).isAuthError).toBe(false);
  expect(new ApiError({ kind: 'network', message: '' }).isAuthError).toBe(false);
});

test('isApiError false cho Error thường / giá trị khác', () => {
  expect(isApiError(new Error('x'))).toBe(false);
  expect(isApiError({ kind: 'http' })).toBe(false);
  expect(isApiError(null)).toBe(false);
});
