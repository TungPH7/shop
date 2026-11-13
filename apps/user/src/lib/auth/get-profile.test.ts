// @vitest-environment node
// getProfile đọc env.API_URL (server) + server-only → chạy `node`; mock getSession (cookie); MSW chặn /profile.
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import { getProfile } from '~/lib/auth/get-profile';
import { getSession } from '~/lib/auth/session';
import { server } from '~/testing/msw/server';

vi.mock('~/lib/auth/session', () => ({ getSession: vi.fn() }));

const URL = 'https://api.example.test/profile';
const BACKEND_PROFILE = {
  id: 1,
  email: 'admin@shop.com',
  name: 'Admin',
  phoneNumber: '', // folder 16: profileSchema mở rộng → fixture cần đủ field, không thì parse fail → null
  avatar: null,
  role: {
    id: 2,
    name: 'ADMIN',
    permissions: [
      {
        id: 9,
        name: 'X',
        description: '',
        module: 'MANAGE-PRODUCT',
        path: '/manage-product/products/:productId',
        method: 'DELETE',
      },
    ],
  },
};

test('chưa đăng nhập → null, KHÔNG gọi backend (khỏi 401 vô ích)', async () => {
  vi.mocked(getSession).mockResolvedValue(null);
  let hits = 0;
  server.use(
    http.get(URL, () => {
      hits++;
      return HttpResponse.json(BACKEND_PROFILE);
    }),
  );
  await expect(getProfile()).resolves.toBeNull();
  expect(hits).toBe(0);
});

test('đã đăng nhập → AuthUser (DTO tối thiểu, role + permissions)', async () => {
  vi.mocked(getSession).mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
  server.use(http.get(URL, () => HttpResponse.json(BACKEND_PROFILE)));
  const user = await getProfile();
  expect(user?.role.name).toBe('ADMIN');
  expect(user?.role.permissions[0]?.method).toBe('DELETE');
});

test('backend 401 (token hết hạn) → null, KHÔNG ném (RSC không crash)', async () => {
  vi.mocked(getSession).mockResolvedValue({ accessToken: 'expired', refreshToken: 'r' });
  server.use(http.get(URL, () => new HttpResponse(null, { status: 401 })));
  await expect(getProfile()).resolves.toBeNull();
});
