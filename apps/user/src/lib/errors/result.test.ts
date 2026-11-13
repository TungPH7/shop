import { expect, test } from 'vitest';

import { NotFoundError } from './app-error';
import { err, isErr, isOk, ok, type Result } from './result';

test('ok bọc value; isOk/isErr phân loại đúng', () => {
  const result = ok(42);
  expect(result).toEqual({ ok: true, value: 42 });
  expect(isOk(result)).toBe(true);
  expect(isErr(result)).toBe(false);
});

test('err bọc error; isOk/isErr phân loại đúng', () => {
  const error = new NotFoundError();
  const result = err(error);
  expect(result).toEqual({ ok: false, error });
  expect(isErr(result)).toBe(true);
  expect(isOk(result)).toBe(false);
});

test('discriminated union thu hẹp value/error theo cờ ok', () => {
  const good: Result<number, NotFoundError> = ok(7);
  const bad: Result<number, NotFoundError> = err(new NotFoundError('missing'));
  expect(good.ok ? good.value : null).toBe(7);
  expect(bad.ok ? null : bad.error.message).toBe('missing');
});
