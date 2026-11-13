import { cacheLife } from 'next/cache';

/**
 * Năm bản quyền cho footer.
 *
 * ⭐ Dưới **Cache Components**, đọc current-time (`new Date()`) lúc PRERENDER trong một Server
 * Component TĨNH bị CẤM (thời gian là dynamic → không thể nằm trong static shell). Next gợi ý
 * chính xác: "đưa biểu thức vào một Cache Component" → ta bọc trong `'use cache'`.
 * `cacheLife('max')`: năm đổi rất hiếm → tính 1 lần, được cache (≈ năm lúc build/revalidate).
 *
 * `use cache` BẮT BUỘC hàm async (hợp đồng directive) dù thân không `await` → đây là trường hợp
 * require-await báo nhầm (khác `getCachedSnapshot` có I/O thật) → tắt đúng 1 dòng.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- use cache = async-by-contract
export async function getCopyrightYear(): Promise<number> {
  'use cache';
  cacheLife('max');
  return new Date().getFullYear();
}
