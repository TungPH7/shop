import { type ProductListFilters } from '@/features/product/model/product';

// Query-key factory of products (ST-005). `lists()` lets a later change, such as a
// delete (US4), refresh every page of the list at once; `detail(id)` is one product,
// as S2 edits it (US3).
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (filters: ProductListFilters) => [...productKeys.lists(), filters] as const,
  detail: (id: string) => [...productKeys.all, 'detail', id] as const,
};
