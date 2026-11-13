import { z } from 'zod';

/**
 * ⭐ Contract QUERY danh sách sản phẩm — schema DÙNG CHUNG client↔server (đầu folder 13).
 *
 * Mirror SUBSET query của backend public `GET /products` (đọc SOURCE thật, KHÔNG đoán —
 * `Nestjs-Super/ecom/src/routes/product/product.model.ts` → `GetProductsQuerySchema`):
 * `page` / `name` / `sortBy` / `orderBy`. (`limit` cố định trong DAL; brand/category/price filter để
 * dành — giữ demo gọn.) enum khớp ĐÚNG hằng backend (`OrderBy` asc|desc, `SortBy` createdAt|price|sale).
 *
 * Hai nguyên tắc validate (folder 13):
 *  1. **Schema = nguồn-sự-thật** → type suy ra bằng `z.infer` (KHÔNG khai trùng).
 *  2. **Locale-agnostic** → schema CHỈ kiểm cấu trúc/ràng buộc, KHÔNG nhúng chuỗi đã dịch; lỗi phát ra
 *     dưới dạng **CODE ổn định** (vd `min(2, { error: 'too_short' })`) để UI map sang i18n bằng
 *     `t('Validation.<code>')` (quyết định folder 13 — nhất quán `reason` codes folder 12).
 */
export const PRODUCT_SORT_BY = ['createdAt', 'price', 'sale'] as const;
export const PRODUCT_ORDER_BY = ['asc', 'desc'] as const;

export type ProductSortBy = (typeof PRODUCT_SORT_BY)[number];
export type ProductOrderBy = (typeof PRODUCT_ORDER_BY)[number];

/**
 * Từ khoá tìm theo tên: tối thiểu 2 ký tự KHI có (1 ký tự ~ vô nghĩa + nặng backend). Tách riêng để
 * **client form** validate hiện lỗi (code `too_short`) VÀ `productListQuerySchema` tái dùng (dưới) →
 * **1 schema, 2 nơi** = bằng chứng "share client/server".
 */
export const productSearchNameSchema = z.string().trim().min(2, { error: 'too_short' });

/**
 * Query đã CHUẨN HOÁ từ `searchParams`. searchParams = đầu vào URL người dùng → KHÔNG tin → **tha
 * thứ**: `.catch(v)` (parse lỗi → fallback) để param hỏng chỉ **SANITIZE** về mặc định an toàn, KHÔNG
 * làm sập trang. (Khác form: form muốn HIỆN lỗi → `productSearchNameSchema` + `getFieldErrorCodes`.)
 */
export const productListQuerySchema = z.object({
  page: z.coerce.number().int().positive().catch(1),
  name: productSearchNameSchema.optional().catch(undefined),
  sortBy: z.enum(PRODUCT_SORT_BY).catch('createdAt'),
  orderBy: z.enum(PRODUCT_ORDER_BY).catch('desc'),
});

/** Type query suy ra từ schema (SSOT) — dùng ở DAL `getProducts(query)` + client filter. */
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

/**
 * `ProductListQuery` → `Record<string,string>` cho URL, **BỎ giá trị mặc định** → URL gọn (vd
 * `/products?name=Áo` thay vì kèm `page=1&sortBy=createdAt&orderBy=desc`). Dùng cho `<Link>` phân trang
 * (giữ filter hiện tại, chỉ đổi `page`). Pure → test được + dùng được cả client.
 */
export function productQueryToParams(query: ProductListQuery): Record<string, string> {
  const params: Record<string, string> = {};
  if (query.page > 1) params.page = String(query.page);
  if (query.name) params.name = query.name;
  if (query.sortBy !== 'createdAt') params.sortBy = query.sortBy;
  if (query.orderBy !== 'desc') params.orderBy = query.orderBy;
  return params;
}
