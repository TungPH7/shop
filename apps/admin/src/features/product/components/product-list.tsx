import { useDeferredValue } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { paths } from '@/config/paths';
import { prefetchProduct } from '@/features/product/api/get-product';
import { useProducts } from '@/features/product/api/get-products';
import { useProductFilters } from '@/features/product/hooks/use-product-filters';
import { formatPriceFromCents } from '@/features/product/model/product';
import { isApiError } from '@/lib/api/api-error';

// UI-agnostic (Phase 1.1): plain markup only. Server data comes from TanStack
// Query (folder 08); the search term is URL state via nuqs (folder 09). Strings
// use the lazy-loaded `product` namespace (folder 14) — the `count` key shows
// i18next pluralization (`count_one`/`count_other`).
export function ProductList() {
  const { t } = useTranslation('product');
  const queryClient = useQueryClient();
  const { search, setSearch } = useProductFilters();
  // Filter against the DEFERRED term so the input stays responsive on large
  // lists: typing updates instantly while the (potentially expensive) filter
  // catches up at lower priority. Pairs with <VirtualList> for big result sets.
  // (Vercel rerender-use-deferred-value.)
  const deferredSearch = useDeferredValue(search);
  const { data: products, isPending, isError, error } = useProducts();

  // Client-side filter once data is present (case-insensitive name match).
  const filtered = products?.filter((product) =>
    product.name.toLowerCase().includes(deferredSearch.toLowerCase()),
  );

  return (
    <section>
      <h2>{t('title')}</h2>

      <label>
        Search:{' '}
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter by name…"
        />
      </label>

      {isPending ? <p role="status">{t('loading')}</p> : null}
      {isError ? (
        <p role="alert">
          Failed to load products: {isApiError(error) ? error.message : 'Unknown error'}
        </p>
      ) : null}
      {filtered ? (
        filtered.length > 0 ? (
          <>
            <p>{t('count', { count: filtered.length })}</p>
            <ul>
              {filtered.map((product) => (
                <li key={product.id}>
                  <Link
                    to={paths.productDetail.getHref(product.id)}
                    // Preload the detail on intent (hover/focus) → instant navigation.
                    onMouseEnter={() => void prefetchProduct(queryClient, product.id)}
                    onFocus={() => void prefetchProduct(queryClient, product.id)}
                  >
                    {product.name}
                  </Link>{' '}
                  — ${formatPriceFromCents(product.priceCents)}
                  {product.inStock ? '' : ' (out of stock)'}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>{t('empty')}</p>
        )
      ) : null}
    </section>
  );
}
