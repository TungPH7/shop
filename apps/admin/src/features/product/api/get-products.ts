import { queryOptions, useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { productKeys } from '@/features/product/api/query-keys';
import { type Product, productSchema } from '@/features/product/model/product';
import { api } from '@/lib/api/api';

const productsSchema = z.array(productSchema);

// Transport: fetch + validate at the boundary (folder 07).
export function getProducts(): Promise<Product[]> {
  return api.get('/products', { schema: productsSchema });
}

// Reusable query definition (v5 `queryOptions`): one typed object shared by
// useQuery, prefetchQuery, ensureQueryData… so the key and fn never drift apart.
export function productsQueryOptions() {
  return queryOptions({
    queryKey: productKeys.lists(),
    queryFn: getProducts,
  });
}

// Hook co-located with the fetcher (bulletproof-react). TanStack Query dedupes
// identical query keys across component instances and caches the result —
// the same benefit the Vercel guide credits to SWR (`client-swr-dedup`).
export function useProducts() {
  return useQuery(productsQueryOptions());
}
