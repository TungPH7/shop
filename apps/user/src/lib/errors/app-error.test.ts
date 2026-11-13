import { expect, test } from 'vitest';

import {
  AppError,
  ForbiddenError,
  isAppError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  UnexpectedError,
  ValidationError,
} from './app-error';

test('mỗi lớp con: kind + name đúng, kế thừa AppError & Error', () => {
  const cases = [
    [new NotFoundError(), 'not_found', 'NotFoundError'],
    [new UnauthorizedError(), 'unauthorized', 'UnauthorizedError'],
    [new ForbiddenError(), 'forbidden', 'ForbiddenError'],
    [new ValidationError(), 'validation', 'ValidationError'],
    [new RateLimitError(), 'rate_limited', 'RateLimitError'],
    [new UnexpectedError(), 'unexpected', 'UnexpectedError'],
  ] as const;

  for (const [error, kind, name] of cases) {
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.kind).toBe(kind);
    expect(error.name).toBe(name);
  }
});

test('message mặc định + tuỳ chỉnh; cause giữ lỗi gốc (KHÔNG nuốt)', () => {
  expect(new NotFoundError().message).toBe('Resource not found');

  const cause = new Error('boom');
  const error = new NotFoundError('Sản phẩm không tồn tại', { cause });
  expect(error.message).toBe('Sản phẩm không tồn tại');
  expect(error.cause).toBe(cause);
});

test('isAppError thu hẹp đúng', () => {
  expect(isAppError(new ForbiddenError())).toBe(true);
  expect(isAppError(new Error('x'))).toBe(false);
  expect(isAppError('nope')).toBe(false);
  expect(isAppError(null)).toBe(false);
});
