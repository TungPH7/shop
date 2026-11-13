// @vitest-environment node
// DAL login đụng `env.API_URL` (biến server) + `server-only` → chạy `node` (jsdom có window →
// t3-env coi là client → throw). MSW chặn fetch ở Node (như client.test folder 11).
import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import { login } from '~/features/auth/server/login';
import { ApiError } from '~/lib/http/api-error';
import { server } from '~/testing/msw/server';

const URL = 'https://api.example.test/auth/login';

test('login OK → trả { accessToken, refreshToken } (validate ở biên)', async () => {
  server.use(
    http.post(URL, () => HttpResponse.json({ accessToken: 'a.b.c', refreshToken: 'd.e.f' })),
  );
  await expect(login({ email: 'a@b.com', password: 'secret' })).resolves.toEqual({
    accessToken: 'a.b.c',
    refreshToken: 'd.e.f',
  });
});

test('sai mật khẩu (401) → ApiError(http)', async () => {
  server.use(http.post(URL, () => new HttpResponse(null, { status: 401 })));
  await expect(login({ email: 'a@b.com', password: 'wrong' })).rejects.toBeInstanceOf(ApiError);
});

test('response thiếu field → ApiError(validation) (Zod ở biên bắt drift)', async () => {
  server.use(http.post(URL, () => HttpResponse.json({ accessToken: 'only-access' })));
  await expect(login({ email: 'a@b.com', password: 'secret' })).rejects.toMatchObject({
    kind: 'validation',
  });
});
