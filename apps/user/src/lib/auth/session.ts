import 'server-only';

import { cookies } from 'next/headers';

import {
  openSession,
  sealSession,
  SESSION_MAX_AGE_SECONDS,
  type SessionTokens,
} from '~/lib/auth/session-seal';

/**
 * Tên cookie tiền tố `__Host-` ⇒ trình duyệt CHỈ chấp nhận khi: Secure + Path=/ + KHÔNG có
 * Domain. Đây là cookie phiên an toàn nhất: không gắn được cho subdomain, không bị ghi đè path.
 * (Trên `http://localhost` trình duyệt vẫn nhận Secure vì coi localhost là "secure context".)
 */
const SESSION_COOKIE = '__Host-session';

const COOKIE_OPTIONS = {
  httpOnly: true, // JS phía client KHÔNG đọc được → XSS không đánh cắp được token.
  secure: true, // bắt buộc cho `__Host-`; chỉ gửi qua HTTPS (localhost là ngoại lệ).
  sameSite: 'lax' as const, // gửi khi điều hướng top-level → đăng nhập xong quay lại vẫn có phiên; chặn CSRF cross-site.
  path: '/', // bắt buộc cho `__Host-`.
};

/** Tạo phiên — CHỈ gọi được trong **Server Action / Route Handler** (nơi set cookie hợp lệ). */
export async function createSession(tokens: SessionTokens): Promise<void> {
  const sealed = await sealSession(tokens);
  (await cookies()).set(SESSION_COOKIE, sealed, {
    ...COOKIE_OPTIONS,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Đọc phiên hiện tại (RSC / Action / Route Handler) → token đã mở, hoặc null.
 * ⚠️ Phải đọc NGOÀI `use cache` (luật cô lập folder 10: không đọc `cookies()` trong cache).
 */
export async function getSession(): Promise<SessionTokens | null> {
  const sealed = (await cookies()).get(SESSION_COOKIE)?.value;
  return openSession(sealed);
}

/**
 * Xoá phiên (đăng xuất) — CHỈ Server Action / Route Handler.
 *
 * ⚠️ KHÔNG dùng `cookies().delete(name)` cho cookie tiền tố `__Host-`: Next phát ra
 * `Set-Cookie: __Host-session=; Path=/; Expires=1970` — tự thêm `Path=/` nhưng **THIẾU `Secure`**, nên
 * trình duyệt TỪ CHỐI (luật `__Host-` của RFC 6265bis bắt mọi Set-Cookie tên `__Host-*` phải có Secure +
 * Path=/ + no Domain) → cookie cũ KHÔNG bị xoá, người dùng vẫn "đăng nhập". Phải ghi đè bằng **đúng**
 * thuộc tính như lúc tạo (đối xứng `createSession` → có `secure:true`) + `maxAge: 0` để hết hạn tức thì.
 */
export async function deleteSession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, '', {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  });
}
