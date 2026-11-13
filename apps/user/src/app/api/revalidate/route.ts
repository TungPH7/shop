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
 * ⚠️ PROD: route công khai như này phải được BẢO VỆ (secret header / auth) — folder 15 (security).
 * ⚠️ Mutation THẬT nên đi qua Server Action (folder 12); đây chỉ minh hoạ `revalidateTag`
 *    chạy được trong Route Handler (đúng docs Next 16).
 */
export function POST() {
  revalidateTag('caching-demo', 'max');
  return NextResponse.json({ revalidated: true, tag: 'caching-demo' });
}
