import { expect, test } from 'vitest';

import { RateLimitError } from '~/lib/errors/app-error';

import { simulateLookup } from './simulate-lookup';

test('shouldFail=false → ok(value)', () => {
  const result = simulateLookup(false);
  expect(result.ok).toBe(true);
  expect(result.ok ? result.value : null).toBe('lookup-ok');
});

test('shouldFail=true → err(RateLimitError) (lỗi DỰ KIẾN, KHÔNG throw)', () => {
  const result = simulateLookup(true);
  expect(result.ok).toBe(false);
  expect(result.ok ? null : result.error).toBeInstanceOf(RateLimitError);
});
