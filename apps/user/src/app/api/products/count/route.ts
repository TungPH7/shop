import { NextResponse } from 'next/server';

import { productListQuerySchema } from '~/features/product/model/product-query';
import { getProducts } from '~/features/product/server/get-products';

/**
 * Route Handler nội bộ (BFF) cho client fetch (seam S2 TanStack): client KHÔNG gọi backend trực tiếp →
 * gọi `/api/*` → DAL `server-only` (`getProducts`, `use cache`) → trả tổng số sản phẩm. NGOÀI `[locale]`
 * (proxy loại `/api` — folder 08). Demo "client server-state": RSC lo first-load, đây cho client refetch.
 */
export async function GET() {
  const result = await getProducts(productListQuerySchema.parse({}));
  return NextResponse.json({ count: result.totalItems });
}
