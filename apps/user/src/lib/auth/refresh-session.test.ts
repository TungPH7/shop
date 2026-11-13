// @vitest-environment node
import { http, HttpResponse } from 'msw';
import { expect, test, vi } from 'vitest';

import { refreshSession } from '~/lib/auth/refresh-session';
import { createSession, getSession } from '~/lib/auth/session';
import { server } from '~/testing/msw/server';

vi.mock('~/lib/auth/session', () => ({ getSession: vi.fn(), createSession: vi.fn() }));

const URL = 'https://api.example.test/auth/refresh-token';

test('không có phiên → null, KHÔNG gọi backend', async () => {
  vi.mocked(getSession).mockResolvedValue(null);
  await expect(refreshSession()).resolves.toBeNull();
  expect(vi.mocked(createSession)).not.toHaveBeenCalled();
});

test('refresh OK → xoay token + re-seal (createSession) + trả cặp mới', async () => {
  vi.mocked(getSession).mockResolvedValue({ accessToken: 'old-a', refreshToken: 'old-r' });
  server.use(
    http.post(URL, () => HttpResponse.json({ accessToken: 'new-a', refreshToken: 'new-r' })),
  );
  const next = await refreshSession();
  expect(next).toEqual({ accessToken: 'new-a', refreshToken: 'new-r' });
  expect(vi.mocked(createSession)).toHaveBeenCalledWith({
    accessToken: 'new-a',
    refreshToken: 'new-r',
  });
});

test('refresh token đã dùng (backend 401) → null, KHÔNG re-seal', async () => {
  vi.mocked(getSession).mockResolvedValue({ accessToken: 'a', refreshToken: 'used' });
  server.use(http.post(URL, () => new HttpResponse(null, { status: 401 })));
  await expect(refreshSession()).resolves.toBeNull();
  expect(vi.mocked(createSession)).not.toHaveBeenCalled();
});
