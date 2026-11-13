'use server';

import { updateTag } from 'next/cache';

import {
  deleteProductInputSchema,
  type ProductActionState,
  type RefreshState,
} from '~/features/product/model/product-actions';
import { deleteProduct } from '~/features/product/server/delete-product';
import { getCurrentUser } from '~/lib/auth/get-current-user';
import { isApiError } from '~/lib/http/api-error';

/**
 * ⭐ `'use server'` (đầu file) → mọi export là **Server Action**: hàm async chạy ở server, nhưng
 * Next phơi chúng thành **endpoint POST** mà client gọi qua RPC (`<form action={…}>` hoặc
 * `useActionState`). Vì là endpoint công khai → coi MỌI input là không tin được.
 *
 * Đặt ở `features/product/actions/` (KHÁC `server/`): `actions/` = lớp `'use server'` (client GỌI
 * được qua RPC); `server/` = `server-only` (KHÔNG bao giờ ra client). File `'use server'` CHỈ được
 * export hàm async → schema/type nằm ở `model/product-actions.ts`. Import `delete-product`/
 * `get-current-user` (`server-only`) ở đây an toàn: chúng chạy server; chỉ THAM CHIẾU hàm action mới
 * vượt sang client (server-only KHÔNG rò xuống bundle).
 */

/**
 * Xoá sản phẩm — pipeline mutation chuẩn (mỏng, delegate xuống DAL):
 *  1) **Validate** input từ FormData (Zod) — không tin client.
 *  2) **Re-authorize** ở server (`getCurrentUser`) — nút bị ẩn KHÔNG phải bảo mật. Chưa đăng nhập
 *     → TỪ CHỐI, KHÔNG gọi backend (secure-by-default; auth thật = folder 15).
 *  3) **Delegate** xuống DAL `server-only` (`deleteProduct`) — action không tự fetch.
 *  4) **updateTag('products')** — read-your-writes (chỉ dùng được TRONG Server Action): lần render
 *     kế tiếp đọc lại `getProducts` nên danh sách phản ánh thay đổi NGAY.
 * Trả `ProductActionState` (không ném cho lỗi-dự-kiến) → form hiện được lỗi.
 */
export async function deleteProductAction(
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const parsed = deleteProductInputSchema.safeParse({ productId: formData.get('productId') });
  if (!parsed.success) {
    return { status: 'error', reason: 'validation' };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { status: 'error', reason: 'auth' };
  }
  // folder 15: kiểm thêm quyền trên CHÍNH sản phẩm này (vd chủ sở hữu / admin) trước khi xoá.

  try {
    await deleteProduct(parsed.data.productId);
  } catch (error) {
    // Backend là tuyến phòng thủ thứ 2 (defense-in-depth): 401/403 → vẫn báo 'auth'.
    if (isApiError(error) && error.isAuthError) {
      return { status: 'error', reason: 'auth' };
    }
    return { status: 'error', reason: 'unknown' };
  }

  updateTag('products');
  return { status: 'success', deletedId: parsed.data.productId };
}

/**
 * Làm mới danh sách sản phẩm on-demand = **bản idiomatic** của thứ folder 10 làm bằng Route Handler
 * (`POST /api/revalidate` + `fetch` + `router.refresh()`). Ở đây dùng `updateTag('products')` trong
 * Server Action → read-your-writes (thấy data mới NGAY ở lần render kế), không cần Route Handler.
 *
 * So sánh với folder 10: `revalidateTag(tag, profile)` (2 tham số) = stale-while-revalidate (có thể
 * cần 1 request nữa mới thấy mới); `updateTag(tag)` (1 tham số, CHỈ trong Server Action) = thấy NGAY.
 *
 * Action công khai (refresh không cần đăng nhập) → bỏ qua re-authz, nhưng vẫn là endpoint server.
 * `new Date()` hợp lệ ở ĐÂY: Server Action chạy request-time (KHÔNG prerender) → khác `use cache`
 * (folder 10 cấm new Date() trong shell prerender).
 */
// eslint-disable-next-line @typescript-eslint/require-await -- 'use server' + useActionState yêu cầu action async; thân chỉ updateTag (đồng bộ)
export async function refreshProductsAction(
  _prevState: RefreshState,
  _formData: FormData,
): Promise<RefreshState> {
  updateTag('products');
  return { status: 'success', refreshedAt: new Date().toISOString() };
}
