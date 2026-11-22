import { queryOptions, useQuery } from '@tanstack/react-query';

import { categoriesKey } from '@/features/product/api/query-keys';
import { type CategoryOption, categoryOptionListSchema } from '@/features/product/model/product';
import { api } from '@/lib/api/api';

// The options of the Category field of the product form (S4.2 of
// docs/specs/SHOP-81/design.md): GET /api/admin/categories, every category, hidden ones
// too, in the order of the api. A query of its own, so the product feature never
// imports the category feature (plan of SHOP-81, Architecture Decisions 9).

/**
 * Starts with `categories`, as every key of the category feature does: an add, edit or
 * delete of a category refreshes these options too.
 */
export const categoryOptionsKey = [...categoriesKey, 'options'] as const;

export async function getCategoryOptions(): Promise<CategoryOption[]> {
  const list = await api.get('/admin/categories', { schema: categoryOptionListSchema });
  return list.items;
}

export function categoryOptionsQueryOptions() {
  return queryOptions({
    queryKey: categoryOptionsKey,
    queryFn: getCategoryOptions,
    // The field shows its own error with Try again (S4.2): no toast on top.
    meta: { skipGlobalError: true },
  });
}

export function useCategoryOptions() {
  return useQuery(categoryOptionsQueryOptions());
}
