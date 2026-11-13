// @vitest-environment node
// `session.ts` đụng `~/config/env/server` (qua session-seal) → chạy `node` (jsdom có window →
// t3-env coi là client → throw, như login.test). `next/headers` được mock (cookies cần request
// context). `server-only` đã được stub ở vitest.config.
import { expect, test, vi } from 'vitest';

// cookieStore phải khai qua vi.hoisted vì factory của vi.mock bị kéo lên TRƯỚC mọi import.
const { cookieStore } = vi.hoisted(() => ({
  cookieStore: { set: vi.fn(), get: vi.fn(), delete: vi.fn() },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(() => Promise.resolve(cookieStore)) }));

import { deleteSession } from '~/lib/auth/session';

/**
 * ⚠️ HỒI QUY bug đăng-xuất-giả: cookie tiền tố `__Host-` chỉ bị xoá nếu Set-Cookie xoá có ĐỦ
 * `Secure` + `Path=/` (luật `__Host-` RFC 6265bis). `cookies().delete(name)` phát header THIẾU
 * `Secure` → trình duyệt từ chối → cookie cũ còn nguyên → vẫn "đăng nhập". Vì vậy deleteSession
 * PHẢI ghi đè qua `set(..., { secure:true, path:'/', maxAge:0 })`, KHÔNG được gọi `.delete()`.
 */
test('deleteSession ghi đè cookie __Host- với Secure + Path=/ + maxAge:0 (KHÔNG dùng .delete())', async () => {
  await deleteSession();

  // Dùng .delete(name) → header xoá thiếu Secure → trình duyệt vứt → bug quay lại.
  expect(cookieStore.delete).not.toHaveBeenCalled();
  expect(cookieStore.set).toHaveBeenCalledWith(
    '__Host-session',
    '',
    expect.objectContaining({ secure: true, path: '/', maxAge: 0 }),
  );
});
