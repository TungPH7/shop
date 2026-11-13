import { type QueryClient, queryOptions, useQuery } from '@tanstack/react-query';

import { productKeys } from '@/features/product/api/query-keys';
import { type Product, productSchema } from '@/features/product/model/product';
import { api } from '@/lib/api/api';

export function getProduct(productId: string): Promise<Product> {
  return api.get(`/products/${productId}`, { schema: productSchema });
}

export function productQueryOptions(productId: string) {
  return queryOptions({
    queryKey: productKeys.detail(productId),
    queryFn: () => getProduct(productId),
  });
}

export function useProduct(productId: string) {
  return useQuery(productQueryOptions(productId));
}

// Warm the cache for a product BEFORE the user navigates (Vercel `bundle-preload`
// — preload on intent). Called on link hover/focus so the detail page renders
// from cache instantly instead of starting a click→fetch waterfall.
export function prefetchProduct(queryClient: QueryClient, productId: string): Promise<void> {
  return queryClient.prefetchQuery(productQueryOptions(productId));
}
