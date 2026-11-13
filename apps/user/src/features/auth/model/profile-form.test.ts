import { expect, test } from 'vitest';

import { changePasswordSchema, updateProfileSchema } from '~/features/auth/model/profile-form';
import { getFieldErrorCodes } from '~/lib/validation/format-zod-error';

test('hợp lệ: name + phone 9–15 + avatar URL', () => {
  const r = updateProfileSchema.safeParse({
    name: 'An',
    phoneNumber: '0123456789',
    avatar: 'https://x.com/a.png',
  });
  expect(r.success).toBe(true);
});

test('phone rỗng + avatar rỗng → hợp lệ (optional-ish khớp backend)', () => {
  expect(updateProfileSchema.safeParse({ name: 'An', phoneNumber: '', avatar: '' }).success).toBe(
    true,
  );
});

test('name rỗng / phone ngắn / avatar sai → code trung tính (share i18n)', () => {
  const r = updateProfileSchema.safeParse({ name: '', phoneNumber: '123', avatar: 'not-a-url' });
  expect(r.success).toBe(false);
  if (!r.success) {
    expect(getFieldErrorCodes(r.error)).toEqual({
      name: 'required',
      phoneNumber: 'invalid_phone',
      avatar: 'invalid_url',
    });
  }
});

test('name quá dài → too_long', () => {
  const r = updateProfileSchema.safeParse({ name: 'x'.repeat(101), phoneNumber: '', avatar: '' });
  expect(r.success).toBe(false);
  if (!r.success) expect(getFieldErrorCodes(r.error).name).toBe('too_long');
});

test('đổi mật khẩu hợp lệ (new === confirm)', () => {
  const r = changePasswordSchema.safeParse({
    password: 'old123',
    newPassword: 'new123',
    confirmNewPassword: 'new123',
  });
  expect(r.success).toBe(true);
});

test('⭐ confirm LỆCH → password_mismatch ở confirmNewPassword (superRefine cross-field)', () => {
  const r = changePasswordSchema.safeParse({
    password: 'old123',
    newPassword: 'new123',
    confirmNewPassword: 'nope456',
  });
  expect(r.success).toBe(false);
  if (!r.success) expect(getFieldErrorCodes(r.error).confirmNewPassword).toBe('password_mismatch');
});

test('mật khẩu mới < 6 → password_too_short', () => {
  const r = changePasswordSchema.safeParse({
    password: 'old123',
    newPassword: 'abc',
    confirmNewPassword: 'abc',
  });
  expect(r.success).toBe(false);
  if (!r.success) expect(getFieldErrorCodes(r.error).newPassword).toBe('password_too_short');
});
