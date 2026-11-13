import { expect, test } from 'vitest';

import { ApiError } from '~/lib/http/api-error';

import {
  ForbiddenError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  UnexpectedError,
  ValidationError,
} from './app-error';
import { normalizeError } from './normalize-error';

test('AppError đi qua nguyên vẹn (không bọc 2 lần)', () => {
  const original = new NotFoundError('x');
  expect(normalizeError(original)).toBe(original);
});

test('ApiError http status → lớp domain tương ứng', () => {
  const map = [
    [400, ValidationError],
    [422, ValidationError],
    [401, UnauthorizedError],
    [403, ForbiddenError],
    [404, NotFoundError],
    [429, RateLimitError],
    [500, UnexpectedError],
  ] as const;

  for (const [status, Expected] of map) {
    const out = normalizeError(new ApiError({ kind: 'http', status, message: `status ${status}` }));
    expect(out).toBeInstanceOf(Expected);
  }
});

test('ApiError network / lệch-schema(validation) → UnexpectedError (lỗi của ta, không phải user)', () => {
  expect(normalizeError(new ApiError({ kind: 'network', message: 'net' }))).toBeInstanceOf(
    UnexpectedError,
  );
  expect(normalizeError(new ApiError({ kind: 'validation', message: 'drift' }))).toBeInstanceOf(
    UnexpectedError,
  );
});

test('Error thường + giá trị KHÔNG phải Error → UnexpectedError, giữ message + cause', () => {
  const plain = new Error('plain boom');
  const fromError = normalizeError(plain);
  expect(fromError).toBeInstanceOf(UnexpectedError);
  expect(fromError.message).toBe('plain boom');
  expect(fromError.cause).toBe(plain);

  const fromString = normalizeError('a string');
  expect(fromString).toBeInstanceOf(UnexpectedError);
  expect(fromString.cause).toBe('a string');
});

test('cause của ApiError được giữ (truy vết nguyên nhân)', () => {
  const api = new ApiError({ kind: 'http', status: 404, message: 'nf' });
  expect(normalizeError(api).cause).toBe(api);
});
