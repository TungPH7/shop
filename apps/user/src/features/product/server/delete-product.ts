import 'server-only';

import { messageResponseSchema } from '~/features/product/model/product-actions';
import { authHeaders } from '~/lib/auth/auth-headers';
import { httpDelete } from '~/lib/http/client';

/**
 * DAL ghi — xoá 1 sản phẩm qua backend NestJS (BFF). `server-only` → KHÔNG lọt client bundle.
 *
 * Contract THẬT (đọc source): `DELETE /manage-product/products/:productId` → `@ApiBearerAuth()` +
 * `@ActiveUser()` (KHÔNG `@IsPublic()`) ⇒ **bắt buộc token**; trả `{ message }`.
 *
 * ⚠️ KHÔNG `use cache` ở đây (đây là mutation, không phải đọc). Làm mới cache là việc của Server
 * Action gọi `updateTag('products')` SAU khi xoá thành công.
 *
 * ⭐ Auth (folder 15 ĐÃ NỐI): `authHeaders()` đọc access token httpOnly NGOÀI use cache → forward
 * `Authorization: Bearer` qua `init.headers`. Chưa đăng nhập → `{}` → backend trả 401 (action map
 * 'auth'). Đã đăng nhập NHƯNG thiếu quyền xoá → backend trả 403 (defense-in-depth, độc lập với
 * re-authz của action).
 */
export async function deleteProduct(productId: number): Promise<void> {
  await httpDelete(`/manage-product/products/${productId}`, messageResponseSchema, {
    headers: await authHeaders(),
  });
}
