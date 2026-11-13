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
 * URL dựng từ `env.API_URL` (đọc runtime, không hardcode) → khớp bất kể backend cấu hình gì (dev/CI).
 * Đây là bộ happy-path ĐẦY ĐỦ + store trong-bộ-nhớ (khác `handlers.ts` của Vitest — rỗng, override
 * per-test). Tái dùng seam S5 (MSW, folder 05): "viết mock một lần, dùng cả unit lẫn E2E".
 */

/** Shape backend (khớp `backendProductSchema`: id/name/basePrice/virtualPrice/images). */
interface BackendProduct {
  id: number;
  name: string;
  basePrice: number;
  virtualPrice: number;
  images: string[];
}

declare global {
  var __e2eProductStore: { products: BackendProduct[] } | undefined;
}

/**
 * Store trong-bộ-nhớ. `E2E Deletable` DÀNH RIÊNG cho test xoá; các test khác KHÔNG assert nó.
 *
 * ⭐ Đặt trên `globalThis` + reset qua `resetE2eStore()` (folder 25 — sửa flaky CI):
 *  - Playwright dùng CHUNG một tiến trình `next start` cho cả run. `reuseExistingServer:false` chỉ dựng
 *    server MỚI mỗi LẦN chạy `playwright test`, KHÔNG phải mỗi retry → nếu không reset, test xoá làm hụt
 *    fixture ở lần retry/test sau (retry không thể pass, che lỗi thật bằng "element not found"). Route
 *    Handler `/api/e2e/reset` gọi `resetE2eStore()` trong `beforeEach` → mỗi test khởi đầu tất định.
 *  - `globalThis` (KHÔNG biến cấp-module) để store là DUY NHẤT dù Turbopack bundle `instrumentation.ts`
 *    và Route Handler reset thành 2 chunk module khác nhau → tránh reset nhầm một mảng "ma" khác với
 *    mảng MSW đang đọc (globalThis luôn cùng một tham chiếu trong một process Node).
 */
function seedProducts(): BackendProduct[] {
  return [
    { id: 101, name: 'E2E Widget', basePrice: 199000, virtualPrice: 249000, images: [] },
    { id: 102, name: 'E2E Gadget', basePrice: 399000, virtualPrice: 399000, images: [] },
    { id: 103, name: 'E2E Deletable', basePrice: 89000, virtualPrice: 129000, images: [] },
  ];
}

const store = (globalThis.__e2eProductStore ??= { products: seedProducts() });

/** Đưa store về seed ban đầu — gọi từ Route Handler `/api/e2e/reset` trước MỖI test (folder 25). */
export function resetE2eStore(): void {
  store.products = seedProducts();
}

/**
 * Hồ sơ ADMIN (khớp `profileSchema` — folder 15): `role.permissions` chứa quyền XOÁ sản phẩm →
 * `hasPermission(DELETE, /manage-product/products/:productId)` true → `<Can>` hiện nút Xoá.
 */
const ADMIN_PROFILE = {
  id: 1,
  email: 'admin@e2e.test',
  name: 'E2E Admin',
  phoneNumber: '0900000000',
  avatar: null,
  role: {
    name: 'ADMIN',
    permissions: [
      { module: 'MANAGE-PRODUCT', path: '/manage-product/products/:productId', method: 'DELETE' },
    ],
  },
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

/**
 * Ảnh PNG 1x1 trong suốt — đủ để `next/image` optimizer xử lý (sharp) mà KHÔNG ra Internet.
 * Chặn `picsum.photos` (xem handler cuối) → E2E tất định + không cạnh tranh CPU/mạng với Server Action.
 */
const STUB_PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  ),
);

const API = env.API_URL;

export const e2eHandlers: RequestHandler[] = [
  // POST /auth/login — luôn trả token ADMIN (happy-path login). Nhánh sai mật khẩu/429 đã có unit test
  // (auth-actions.test) → E2E tập trung luồng ĐĂNG NHẬP THÀNH CÔNG + hệ quả (cookie, AuthStatus, RBAC).
  http.post(`${API}/auth/login`, () =>
    HttpResponse.json({
      accessToken: makeAccessToken(1, 'ADMIN'),
      refreshToken: 'e2e-refresh-token',
    }),
  ),
  // POST /auth/logout — best-effort revoke ở backend (logoutAction gọi trước khi xoá cookie).
  http.post(`${API}/auth/logout`, () => HttpResponse.json({ message: 'Logged out' })),
  // GET /profile — hồ sơ + quyền (cho <Can>/getProfile). Bearer được forward nhưng mock bỏ qua.
  http.get(`${API}/profile`, () => HttpResponse.json(ADMIN_PROFILE)),
  // GET /products — danh sách phân trang (DAL `getProducts`, `use cache`). Bỏ qua query → trả store.
  http.get(`${API}/products`, () =>
    HttpResponse.json({
      data: store.products,
      totalItems: store.products.length,
      page: 1,
      limit: 10,
      totalPages: 1,
    }),
  ),
  // DELETE /manage-product/products/:productId — STATEFUL: xoá khỏi store → render kế (sau updateTag)
  // phản ánh danh sách mới. Chứng minh trọn vòng mutation → revalidate → re-render server (folder 12).
  http.delete(`${API}/manage-product/products/:productId`, ({ params }) => {
    const id = Number(params.productId);
    const index = store.products.findIndex((product) => product.id === id);
    if (index >= 0) store.products.splice(index, 1);
    return HttpResponse.json({ message: 'Product deleted' });
  }),
  // GET picsum.photos/* — ảnh placeholder demo (productImageSrc). `next/image` optimizer fetch Ở SERVER;
  // để ra Internet thật (onUnhandledRequest:'bypass') làm E2E chậm/flaky trên CI và cạnh tranh tài nguyên
  // với Server Action đang chạy (bài học: delete pending >5s). Trả PNG stub tại chỗ → 0 mạng ngoài, tất
  // định. RegExp khớp mọi path picsum (msw 2.x hỗ trợ RegExp cho URL request).
  http.get(/https:\/\/picsum\.photos\//, () =>
    HttpResponse.arrayBuffer(STUB_PNG.buffer, { headers: { 'Content-Type': 'image/png' } }),
  ),
];
