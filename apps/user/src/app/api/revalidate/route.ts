import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';

/**
 * Route Handler on-demand revalidation cho demo folder 10.
 * `revalidateTag(tag, profile)` (Next 16 BẮT BUỘC 2 tham số) → đánh dấu entry cache mang tag
 * đó là stale theo profile → tạo lại `getCachedSnapshot` → mốc thời gian CACHE đổi.
 *  - `'max'` = **stale-while-revalidate**: phục vụ bản cũ ngay, làm mới nền → có thể cần
 *    1 request nữa mới thấy giá trị mới (đúng ngữ nghĩa SWR).
 *  - Muốn "read-your-own-writes" (thấy MỚI ngay) → `updateTag` trong **Server Action** (folder 12).
 *
 * Đặt ở `app/api/*` (NGOÀI `[locale]`) → proxy matcher loại `/api` nên KHÔNG bị localize.
 * ⚠️ Mutation THẬT nên đi qua Server Action (folder 12); đây chỉ minh hoạ `revalidateTag`
 *    chạy được trong Route Handler (đúng docs Next 16).
 *
 * The route has no session, and the Proxy skips `/api`, so it guards itself: it answers only a POST whose Origin is
 * this site, as the browser sends it from the demo page (SHOP-39). A Route Handler that changes state checks its caller
 * the same way, or with a session.
 */
export function POST(request: Request) {
  if (!isFromThisSite(request)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  revalidateTag('caching-demo', 'max');
  return NextResponse.json({ revalidated: true, tag: 'caching-demo' });
}

/** Whether the Origin of the request names the host it was sent to; the proxy in front keeps the Host header. */
function isFromThisSite(request: Request): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin === null || host === null) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
