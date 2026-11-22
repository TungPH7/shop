'use client';

import { useTranslations } from 'next-intl';

/** Skeleton cards while the products load: 8 (design.md of SHOP-7, S4.5, loading). */
const SKELETON_CARDS = 8;

/**
 * What S4 shows while it reads the products: the place of the search and the sort, with no field to type into yet,
 * since the real ones replace it; then 8 skeleton cards in a busy list, with no words. On the page of a category
 * (`search: false`, S5 of SHOP-81), the place of the sort alone.
 *
 * A client component: it is the fallback of a `<Suspense>`, so it renders in the static shell. The page of a category
 * cannot call `setRequestLocale` there, since its slug is known only at request time, and a server `useTranslations`
 * would then read the request headers and fail `next build`. On the client it reads the messages of the
 * NextIntlClientProvider of the layout, as ProductNotFound does.
 */
export function ProductResultsSkeleton({ search = true }: { search?: boolean }) {
  const t = useTranslations('Products');

  return (
    <>
      <div
        className={search ? 'product-filters' : 'product-filters product-filters--sort-only'}
        aria-hidden="true"
      >
        {search && <span className="skeleton product-filters__search product-filters__skeleton" />}
        <span className="skeleton product-filters__sort product-filters__skeleton" />
      </div>
      <ul className="product-grid" aria-label={t('list')} aria-busy="true">
        {Array.from({ length: SKELETON_CARDS }, (_, i) => (
          <li key={i}>
            <div className="card product-card">
              <span className="skeleton product-card__skeleton-tile" />
              <span className="skeleton product-card__skeleton-line" />
              <span className="skeleton product-card__skeleton-price" />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
