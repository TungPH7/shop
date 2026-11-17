import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';

import { productKeys } from '@/features/product/api/query-keys';
import {
  type AdminProductPage,
  adminProductPageSchema,
  type ProductListFilters,
} from '@/features/product/model/product';
import { api } from '@/lib/api/api';

// GET /api/admin/products (API Contract of docs/specs/SHOP-7/plan.md): one page of
// the admin list, newest first.

/** Products per page of the admin list (S1.6, S1.11). */
export const PRODUCTS_PAGE_SIZE = 20;

/** The largest offset the API takes: an `int` of Java. */
const MAX_OFFSET = 2 ** 31 - 1;

/**
 * The last page whose offset fits the API (107 374 183). A page past it would get a
 * 400 that Try again never fixes, so it is a wrong page, like "0" (S1.11).
 */
export const PRODUCTS_MAX_PAGE = Math.floor(MAX_OFFSET / PRODUCTS_PAGE_SIZE) + 1;

function fetchPage(filters: ProductListFilters, page: number): Promise<AdminProductPage> {
  const q = filters.q.trim();
  return api.get('/admin/products', {
    params: {
      ...(q === '' ? {} : { q }),
      // The URL holds the status in lower case; the API takes only upper case.
      status: filters.status.toUpperCase(),
      offset: (page - 1) * PRODUCTS_PAGE_SIZE,
      limit: PRODUCTS_PAGE_SIZE,
    },
    schema: adminProductPageSchema,
  });
}

/**
 * The page of the filters. A page past the last one, as an old link after products
 * were deleted, shows page 1 (S1.11): the result then has offset 0. So does a page
 * past PRODUCTS_MAX_PAGE, which the URL already turns into page 1.
 */
export async function getProducts(filters: ProductListFilters): Promise<AdminProductPage> {
  if (filters.page > PRODUCTS_MAX_PAGE) return fetchPage(filters, 1);
  const result = await fetchPage(filters, filters.page);
  const isPastLastPage = result.items.length === 0 && result.totalItems > 0 && filters.page > 1;
  return isPastLastPage ? fetchPage(filters, 1) : result;
}

export function productsQueryOptions(filters: ProductListFilters) {
  return queryOptions({
    queryKey: productKeys.list(filters),
    queryFn: () => getProducts(filters),
    // Keep the rows on screen while the next filter or page loads (NFR6).
    placeholderData: keepPreviousData,
  });
}

export function useProducts(filters: ProductListFilters) {
  return useQuery(productsQueryOptions(filters));
}
