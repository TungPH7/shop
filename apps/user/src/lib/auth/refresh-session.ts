import 'server-only';

import { createSession, getSession } from '~/lib/auth/session';
import { sessionTokensSchema, type SessionTokens } from '~/lib/auth/session-seal';
import { httpPost } from '~/lib/http/client';

/**
 * Refresh-ROTATION — `POST /auth/refresh-token`. Backend XOAY: refresh token cũ bị xoá; dùng lại →
 * `RefreshTokenAlreadyUsed`. Đọc refresh token từ phiên → đổi cặp token mới → NIÊM PHONG LẠI cookie.
 *
 * ⭐⭐ CHỈ gọi được nơi SET được cookie: **Route Handler / Server Action** — KHÔNG phải lúc RSC render
 * (render không set được cookie). Vì vậy refresh sống ở Route Handler `/api/auth/refresh` (có thể gọi
 * thêm từ Server Action); còn RSC gặp access token hết hạn thì `getProfile`/guard trả null → redirect
 * /login (không tự refresh được). Đây là RÀNG BUỘC then chốt của mô hình cookie server-first.
 *
 * Trả cặp token mới, hoặc null nếu không có phiên / refresh thất bại (caller nên xoá phiên + về login).
 */
export async function refreshSession(): Promise<SessionTokens | null> {
  const session = await getSession();
  if (!session) return null;
  let next: SessionTokens;
  try {
    next = await httpPost('/auth/refresh-token', sessionTokensSchema, {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
  } catch {
    return null; // refresh token hết hạn / đã dùng → caller xử lý (xoá phiên + login)
  }
  await createSession(next); // re-seal cookie (hợp lệ trong Route Handler / Server Action)
  return next;
}
