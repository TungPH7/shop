import { type ZodType } from 'zod';

/**
 * Chuẩn hoá raw `searchParams` của Next (mỗi value = `string | string[] | undefined`) → object phẳng
 * rồi VALIDATE bằng Zod (folder 13). searchParams là đầu vào NGƯỜI DÙNG (URL) → KHÔNG tin →
 * "**parse, don't validate**" tại boundary.
 *
 * ⚠️ Dùng với schema **TỔNG** (mọi field `.catch()/.default()/.optional()`) → `parse` KHÔNG bao giờ
 * ném cho param URL hỏng (chỉ sanitize). Chủ ý: URL rác KHÔNG được làm sập trang (khác form — form
 * cần hiện lỗi).
 *
 * Param lặp (`?sortBy=a&sortBy=b`) hiếm → lấy phần tử ĐẦU (chuẩn cho query đơn-giá-trị).
 *
 * Pure (chỉ phụ thuộc Zod) → đặt ở `lib/validation` (shared) → cả server (page đọc `searchParams`) lẫn
 * client (đọc `useSearchParams`) đều dùng được = đúng tinh thần "share".
 */
export function parseSearchParams<T>(
  schema: ZodType<T>,
  raw: Record<string, string | string[] | undefined>,
): T {
  const flat: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    flat[key] = Array.isArray(value) ? value[0] : value;
  }
  return schema.parse(flat);
}
