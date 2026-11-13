import { expect, test } from 'vitest';

import { loginInputSchema, loginResponseSchema } from '~/features/auth/model/auth';
import { getFieldErrorCodes } from '~/lib/validation/format-zod-error';

test('loginInputSchema: hợp lệ', () => {
  const r = loginInputSchema.safeParse({ email: 'a@b.com', password: 'secret' });
  expect(r.success).toBe(true);
});

test('loginInputSchema: email sai + password rỗng → code trung tính (share i18n)', () => {
  const r = loginInputSchema.safeParse({ email: 'nope', password: '' });
  expect(r.success).toBe(false);
  if (!r.success) {
    expect(getFieldErrorCodes(r.error)).toEqual({ email: 'invalid_email', password: 'required' });
  }
});

test('loginResponseSchema: cần đủ 2 token không rỗng', () => {
  expect(loginResponseSchema.safeParse({ accessToken: 'a', refreshToken: 'b' }).success).toBe(true);
  expect(loginResponseSchema.safeParse({ accessToken: 'a' }).success).toBe(false);
  expect(loginResponseSchema.safeParse({ accessToken: '', refreshToken: 'b' }).success).toBe(false);
});
