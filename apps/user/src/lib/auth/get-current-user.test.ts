// @vitest-environment node
import { SignJWT } from 'jose';
import { expect, test, vi } from 'vitest';

import { getCurrentUser } from '~/lib/auth/get-current-user';
import { getSession } from '~/lib/auth/session';

// Mock seam phiên → KHÔNG nạp `next/headers` (cookies cần request context). getCurrentUser chỉ
// DECODE access token nên khoá ký ở đây vô nghĩa (decode không verify chữ ký) — bài học cốt lõi.
vi.mock('~/lib/auth/session', () => ({ getSession: vi.fn() }));

const SIGN_KEY = new TextEncoder().encode('decode-does-not-verify-this-signature!!');
const nowSec = (): number => Math.floor(Date.now() / 1000);
function accessToken(claims: Record<string, unknown>): Promise<string> {
  return new SignJWT(claims).setProtectedHeader({ alg: 'HS256' }).sign(SIGN_KEY);
}

test('không có phiên → null (secure-by-default)', async () => {
  vi.mocked(getSession).mockResolvedValue(null);
  await expect(getCurrentUser()).resolves.toBeNull();
});

test('phiên hợp lệ → { id, role } decode từ access token', async () => {
  const token = await accessToken({ userId: 7, roleName: 'ADMIN', exp: nowSec() + 3600 });
  vi.mocked(getSession).mockResolvedValue({ accessToken: token, refreshToken: 'r' });
  await expect(getCurrentUser()).resolves.toEqual({ id: 7, role: 'ADMIN' });
});

test('access token hết hạn → null', async () => {
  const token = await accessToken({ userId: 7, roleName: 'ADMIN', exp: nowSec() - 60 });
  vi.mocked(getSession).mockResolvedValue({ accessToken: token, refreshToken: 'r' });
  await expect(getCurrentUser()).resolves.toBeNull();
});

test('access token rác → null', async () => {
  vi.mocked(getSession).mockResolvedValue({ accessToken: 'garbage', refreshToken: 'r' });
  await expect(getCurrentUser()).resolves.toBeNull();
});
