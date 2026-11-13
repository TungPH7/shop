import createMiddleware from 'next-intl/middleware';

import { routing } from '~/i18n/routing';

/**
 * Proxy — **Next 16** đổi tên `middleware.ts` → `proxy.ts` (next-intl hỗ trợ chính thức:
 * "proxy.ts was called middleware.ts up until Next.js 16", nội dung file y hệt).
 *
 * Folder 09 THAY redirect i18n viết tay của folder 08 bằng **middleware của next-intl**
 * (`createMiddleware`) — lo: thương lượng locale theo `Accept-Language`, redirect URL
 * thiếu locale (`/` → `/en`), nhớ lựa chọn qua cookie, sinh alternate-links cho SEO.
 *
 * ⚠️ KHÔNG phải security boundary (CVE-2025-29927): chỉ định tuyến i18n; authz THẬT
 * verify ở DAL (folder 11/15). Node runtime; không DB/logic nặng.
 */
export default createMiddleware(routing);

export const config = {
  // Bỏ qua nội bộ Next + mọi path có dấu chấm (asset: .css/.js/.png/...) → proxy chỉ
  // chạy trên route trang. (Matcher khuyến nghị của next-intl.)
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
