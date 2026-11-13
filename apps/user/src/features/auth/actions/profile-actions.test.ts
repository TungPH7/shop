// @vitest-environment node
import { expect, test, vi } from 'vitest';

import { changePasswordAction, updateProfileAction } from '~/features/auth/actions/profile-actions';
import { changePassword } from '~/features/auth/server/change-password';
import { updateProfile } from '~/features/auth/server/update-profile';
import { getCurrentUser } from '~/lib/auth/get-current-user';
import { ApiError } from '~/lib/http/api-error';

vi.mock('~/features/auth/server/change-password', () => ({ changePassword: vi.fn() }));
vi.mock('~/features/auth/server/update-profile', () => ({ updateProfile: vi.fn() }));
vi.mock('~/lib/auth/get-current-user', () => ({ getCurrentUser: vi.fn() }));

const VALID = { name: 'An', phoneNumber: '', avatar: '' };

test('input sai → validation + fieldErrors; KHÔNG gọi backend', async () => {
  const s = await updateProfileAction({ name: '', phoneNumber: '', avatar: '' });
  expect(s).toEqual({ status: 'error', reason: 'validation', fieldErrors: { name: 'required' } });
  expect(vi.mocked(updateProfile)).not.toHaveBeenCalled();
});

test('chưa đăng nhập (getCurrentUser null) → auth; KHÔNG gọi backend', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  const s = await updateProfileAction(VALID);
  expect(s).toEqual({ status: 'error', reason: 'auth' });
  expect(vi.mocked(updateProfile)).not.toHaveBeenCalled();
});

test('đăng nhập + cập nhật OK → success (re-validate cùng schema)', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, role: 'CLIENT' });
  vi.mocked(updateProfile).mockResolvedValue({ id: 1, name: 'An' });
  const s = await updateProfileAction(VALID);
  expect(s).toEqual({ status: 'success' });
  expect(vi.mocked(updateProfile)).toHaveBeenCalledWith(VALID);
});

test('backend 401 (defense-in-depth) → auth', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, role: 'CLIENT' });
  vi.mocked(updateProfile).mockRejectedValue(
    new ApiError({ kind: 'http', status: 401, message: 'x' }),
  );
  expect(await updateProfileAction(VALID)).toEqual({ status: 'error', reason: 'auth' });
});

test('backend lỗi khác → unknown', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, role: 'CLIENT' });
  vi.mocked(updateProfile).mockRejectedValue(
    new ApiError({ kind: 'http', status: 500, message: 'x' }),
  );
  expect(await updateProfileAction(VALID)).toEqual({ status: 'error', reason: 'unknown' });
});

const VALID_PWD = { password: 'old123', newPassword: 'new123', confirmNewPassword: 'new123' };

test('đổi mật khẩu: confirm lệch → validation (password_mismatch); KHÔNG gọi backend', async () => {
  const s = await changePasswordAction({
    password: 'old123',
    newPassword: 'new123',
    confirmNewPassword: 'x',
  });
  expect(s.status).toBe('error');
  if (s.status === 'error' && s.reason === 'validation') {
    expect(s.fieldErrors.confirmNewPassword).toBe('password_mismatch');
  }
  expect(vi.mocked(changePassword)).not.toHaveBeenCalled();
});

test('đổi mật khẩu: chưa đăng nhập → auth', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue(null);
  expect(await changePasswordAction(VALID_PWD)).toEqual({ status: 'error', reason: 'auth' });
});

test('đổi mật khẩu OK → success', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, role: 'CLIENT' });
  vi.mocked(changePassword).mockResolvedValue({ message: 'ok' });
  expect(await changePasswordAction(VALID_PWD)).toEqual({ status: 'success' });
  expect(vi.mocked(changePassword)).toHaveBeenCalledWith(VALID_PWD);
});

test('đổi mật khẩu: mật khẩu hiện tại sai (backend 422) → unknown', async () => {
  vi.mocked(getCurrentUser).mockResolvedValue({ id: 1, role: 'CLIENT' });
  vi.mocked(changePassword).mockRejectedValue(
    new ApiError({ kind: 'http', status: 422, message: 'x' }),
  );
  expect(await changePasswordAction(VALID_PWD)).toEqual({ status: 'error', reason: 'unknown' });
});
