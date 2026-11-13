// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import { changePassword } from '~/features/auth/server/change-password';
import { ApiError } from '~/lib/http/api-error';
import { server } from '~/testing/msw/server';

vi.mock('~/lib/auth/auth-headers', () => ({
  authHeaders: vi.fn().mockResolvedValue({ Authorization: 'Bearer t' }),
}));

const URL = 'https://api.example.test/profile/change-password';
const INPUT = { password: 'old123', newPassword: 'new123', confirmNewPassword: 'new123' };

test('PUT /profile/change-password OK → { message }', async () => {
  server.use(http.put(URL, () => HttpResponse.json({ message: 'Đổi mật khẩu thành công' })));
  await expect(changePassword(INPUT)).resolves.toEqual({ message: 'Đổi mật khẩu thành công' });
});

test('mật khẩu hiện tại sai (422) → ApiError', async () => {
  server.use(http.put(URL, () => new HttpResponse(null, { status: 422 })));
  await expect(changePassword(INPUT)).rejects.toBeInstanceOf(ApiError);
});
