import { type QueryClient } from '@tanstack/react-query';

import { categoriesKey, productKeys } from '@/features/product/api/query-keys';

/**
 * What an add, edit or delete of a product makes stale: every page of the list of
 * products, as a deleted product may shift the next ones, and every query of the
 * categories, whose product counts change with it (AC9 of SHOP-81). The Categories
 * page and the delete dialog of a category then show the count of now. The product
 * itself loads anew each time the form opens (productQueryOptions), so it is left alone.
 *
 * The write waits for the list of products only. The categories load anew in the
 * background: the field Category of the form keeps a query of them in use, and the
 * saved product does not wait for that GET, which may be slow or retried, before its
 * toast and the move to the list.
 */
export async function refreshAfterProductWrite(queryClient: QueryClient): Promise<void> {
  void queryClient.invalidateQueries({ queryKey: categoriesKey });
  await queryClient.invalidateQueries({ queryKey: productKeys.lists() });
}
