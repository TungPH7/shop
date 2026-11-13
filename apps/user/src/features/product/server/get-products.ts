import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import {
  mapToProduct,
  type ProductListResult,
  productListResponseSchema,
} from '~/features/product/model/product';
import { type ProductListQuery } from '~/features/product/model/product-query';
import { httpGet } from '~/lib/http/client';

/** Số sản phẩm mỗi trang — CỐ ĐỊNH ở DAL (KHÔNG cho client đổi `limit` qua URL → tránh lạm dụng). */
const PAGE_SIZE = 10;

/**
 * DAL đọc danh sách sản phẩm — BFF: gọi backend NestJS qua http client (folder 11) với query ĐÃ
 * VALIDATE (folder 13). `getProducts` nhận `ProductListQuery` (đã qua `parseSearchParams` ở page) →
 * forward `page/limit/name/sortBy/orderBy` xuống `GET /products` (khớp `GetProductsQuerySchema` backend
 * — đọc source thật, không đoán).
 *
 * - `use cache` (folder 10) + cache-key = **args** → mỗi query (trang/sort/tìm) là 1 entry cache RIÊNG;
 *   `cacheLife('hours')` + `cacheTag('products')` → `updateTag('products')` (folder 12) làm mới tất cả.
 * - Trả `ProductListResult`: DTO[] tối thiểu (`mapToProduct`) + meta phân trang từ envelope.
 */
export async function getProducts(query: ProductListQuery): Promise<ProductListResult> {
  'use cache';
  cacheLife('hours');
  cacheTag('products');

  const search = new URLSearchParams({
    page: String(query.page),
    limit: String(PAGE_SIZE),
    sortBy: query.sortBy,
    orderBy: query.orderBy,
  });
  if (query.name) {
    search.set('name', query.name);
  }

  const response = await httpGet(`/products?${search.toString()}`, productListResponseSchema);
  return {
    items: response.data.map(mapToProduct),
    page: response.page,
    totalPages: response.totalPages,
    totalItems: response.totalItems,
  };
}
