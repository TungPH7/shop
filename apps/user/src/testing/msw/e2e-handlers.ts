import { http, HttpResponse, type RequestHandler } from 'msw';

import { env } from '~/config/env/server';

/**
 * MSW handlers cho E2E (folder 24) — chặn các lời gọi `fetch` của BFF phía SERVER tới backend NestJS.
 *
 * ⭐⭐ Vì sao cần cái này (khác hẳn React SPA sibling): App Router fetch data Ở SERVER (DAL
 * `server-only`). `page.route` của Playwright chỉ chặn request TỪ TRÌNH DUYỆT → KHÔNG thấy fetch
 * server→backend. Giải pháp chuẩn (enterprise consensus): chạy MSW/node TRONG chính process Next
 * (qua `instrumentation.ts`, folder 18) → nó patch http client của Node → thấy MỌI outbound của server.
 *
 * Only the auth API of the old NestJS backend is left, for the tests of the login Epic: the product API of the template
 * is gone (TW4 of SHOP-7), and the catalog tests run against the real api. A URL is built as `request()` of
 * `~/lib/http/client` builds it, with `new URL(path, env.API_URL)`.
 */

const apiUrl = (path: string): string => new URL(path, env.API_URL).href;

/** Hồ sơ ADMIN (khớp `profileSchema` — folder 15), cho `getProfile`. */
const ADMIN_PROFILE = {
  id: 1,
  email: 'admin@e2e.test',
  name: 'E2E Admin',
  phoneNumber: '0900000000',
  avatar: null,
  role: { name: 'ADMIN', permissions: [] },
};

/**
 * Access token GIẢ cho login. `getCurrentUser` (folder 15) CHỈ `decodeJwt` — KHÔNG verify chữ ký
 * backend (ta không giữ secret của nó) → chỉ cần payload đúng shape `{ userId, roleName, exp }`.
 * `exp` đặt ở tương lai để không "hết hạn" trong lúc test. Cookie phiên vẫn được NIÊM PHONG THẬT bằng
 * jose + AUTH_SECRET (createSession) → chứng minh cả pipeline seal/unseal, chỉ token BÊN TRONG là giả.
 */
function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
function makeAccessToken(userId: number, roleName: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url({ alg: 'HS256', typ: 'JWT' });
  const payload = base64url({ userId, roleName, iat: now, exp: now + 3600 });
  return `${header}.${payload}.e2e-signature-not-verified`;
}

export const e2eHandlers: RequestHandler[] = [
  // POST /auth/login — luôn trả token ADMIN (happy-path login). Nhánh sai mật khẩu/429 đã có unit test
  // (auth-actions.test) → E2E tập trung luồng ĐĂNG NHẬP THÀNH CÔNG + hệ quả (cookie, AuthStatus).
  http.post(apiUrl('/auth/login'), () =>
    HttpResponse.json({
      accessToken: makeAccessToken(1, 'ADMIN'),
      refreshToken: 'e2e-refresh-token',
    }),
  ),
  // POST /auth/logout — best-effort revoke ở backend (logoutAction gọi trước khi xoá cookie).
  http.post(apiUrl('/auth/logout'), () => HttpResponse.json({ message: 'Logged out' })),
  // GET /profile — hồ sơ + quyền (cho getProfile). Bearer được forward nhưng mock bỏ qua.
  http.get(apiUrl('/profile'), () => HttpResponse.json(ADMIN_PROFILE)),
];
