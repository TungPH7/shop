import { z } from 'zod';

/**
 * Model cho TẦNG GHI (Server Actions, folder 12) — tách khỏi `product.ts` (tầng ĐỌC) vì file
 * Server Action (`'use server'`) CHỈ được export hàm async; mọi schema/type/hằng phải sống ở file
 * THƯỜNG như này rồi được action + client import vào.
 */

/**
 * Schema input của `deleteProductAction`. Input đến từ `FormData` (client) → KHÔNG tin được →
 * validate NGAY trong action. `z.coerce.number()` ép chuỗi "29" → 29; null/File → NaN → trượt
 * `.positive()`. Đây là contract DELETE backend thật: `DELETE /manage-product/products/:productId`
 * với `productId` là số nguyên dương (xem `GetProductParamsSchema` của NestJS).
 */
export const deleteProductInputSchema = z.object({
  productId: z.coerce.number().int().positive(),
});

/**
 * Response của DELETE backend: `MessageResSchema` = `{ message: string }`
 * (NestJS `manage-product` trả `MessageResDTO`). Validate ở biên như mọi response khác (folder 11).
 */
export const messageResponseSchema = z.object({
  message: z.string(),
});

/**
 * Permission backend cho xoá sản phẩm — khớp seed `create-permissions.ts` (1 permission / route Express):
 * `DELETE /manage-product/products/:productId`, module `MANAGE-PRODUCT`. Dùng cho `<Can>` (ẩn nút Xoá
 * nếu user thiếu quyền). ADMIN + SELLER (có module MANAGE-PRODUCT) thấy; CLIENT thì không.
 */
export const DELETE_PRODUCT_PERMISSION = {
  method: 'DELETE',
  path: '/manage-product/products/:productId',
} as const;

/** Lý do thất bại — đủ để client map sang copy đã localize, KHÔNG lộ chi tiết lỗi nội bộ. */
export type DeleteFailureReason = 'validation' | 'auth' | 'unknown';

/**
 * State cho `useActionState(deleteProductAction)`. Là union phân biệt + **serializable** (state
 * đi qua dây server↔client). Action TRẢ state (không `throw` qua boundary cho lỗi-dự-kiến) → form
 * hiển thị được; chỉ `redirect()`/lỗi-thật mới ném.
 */
export type ProductActionState =
  | { status: 'idle' }
  | { status: 'success'; deletedId: number }
  | { status: 'error'; reason: DeleteFailureReason };

/** State cho `useActionState(refreshProductsAction)` — mốc thời gian làm mới (request-time). */
export type RefreshState = { status: 'idle' } | { status: 'success'; refreshedAt: string };

/** State khởi tạo cho 2 action — dùng chung ở client. */
export const initialProductActionState: ProductActionState = { status: 'idle' };
export const initialRefreshState: RefreshState = { status: 'idle' };
