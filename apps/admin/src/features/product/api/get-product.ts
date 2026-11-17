import { queryOptions, useQuery } from '@tanstack/react-query';

import { productKeys } from '@/features/product/api/query-keys';
import { type AdminProduct, adminProductSchema } from '@/features/product/model/product';
import { api } from '@/lib/api/api';
import { isApiError } from '@/lib/api/api-error';

// GET /api/admin/products/{id} (API Contract of docs/specs/SHOP-7/plan.md): the product
// S2 edits (US3), a hidden one too, with the `version` an edit sends back (AC13).

export function getProduct(id: string): Promise<AdminProduct> {
  return api.get(`/admin/products/${encodeURIComponent(id)}`, { schema: adminProductSchema });
}

/**
 * Whether the product is not there: a 404, never made or deleted, or a 400 of an id
 * that is no UUID, which no product has. S2 shows its not-found state (S2.3), which
 * Try again would never change.
 */
export function isProductMissing(error: unknown): boolean {
  return (
    isApiError(error) && error.kind === 'http' && (error.status === 404 || error.status === 400)
  );
}

export function productQueryOptions(id: string) {
  return queryOptions({
    queryKey: productKeys.detail(id),
    queryFn: () => getProduct(id),
    // The form edits the version it opened with: only Reload loads a newer one (AC13),
    // so no refetch on focus or on reconnect. Opened again, it loads the product anew.
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // The page shows a missing product itself (S2.3): no toast on top.
    meta: { skipGlobalError: true },
  });
}

export function useProduct(id: string) {
  return useQuery(productQueryOptions(id));
}
