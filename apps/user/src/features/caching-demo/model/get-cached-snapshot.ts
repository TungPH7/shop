import { cacheLife, cacheTag } from 'next/cache';

export interface CacheSnapshot {
  /** Thời điểm hàm CHẠY THẬT (tạo/làm mới cache) — KHÔNG phải mỗi request. */
  generatedAt: string;
}

/**
 * Nguồn data "đã cache" cho demo folder 10.
 *
 * `'use cache'` (đầu thân hàm) → Next cache kết quả theo cache-key (buildId + id hàm +
 * args; ở đây không args). Khi prerender, kết quả đi vào **static shell**.
 *  - `cacheLife('hours')`: stale 5m / revalidate 1h / expire 1d → đứng yên suốt buổi demo.
 *  - `cacheTag('caching-demo')`: cho `revalidateTag('caching-demo')` xoá on-demand.
 *
 * ⚠️ Trong scope `use cache` KHÔNG được đọc request-time (`cookies()/headers()/params`):
 *    môi trường cô lập (đọc vào sẽ lỗi/treo build). Cần data request → đọc NGOÀI rồi
 *    truyền vào làm **args** (chúng thành phần của cache-key).
 * 🔭 Folder 11 (DAL) thay thân hàm bằng `fetch`/query backend THẬT, giữ nguyên 3 dòng cache.
 */
export async function getCachedSnapshot(): Promise<CacheSnapshot> {
  'use cache';
  cacheLife('hours');
  cacheTag('caching-demo');

  // Mô phỏng nguồn data CHẬM (I/O backend ~300ms): chi phí này trả **1 LẦN** lúc build/
  // revalidate rồi được cache → mọi request sau lấy tức thì. Đây chính là giá trị của cache.
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 300);
  });

  return { generatedAt: new Date().toISOString() };
}
