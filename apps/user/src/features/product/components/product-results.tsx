import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { LoadMoreButton } from '~/features/product/components/load-more-button';
import { ProductCard } from '~/features/product/components/product-card';
import { ProductFilters } from '~/features/product/components/product-filters';
import { nextProductsHref, parseProductQuery } from '~/features/product/model/product-query';
import { getStoreProducts } from '~/features/product/server/get-products';
import { Link } from '~/i18n/navigation';

/** The id of the grid, for Load more to move the focus to the first new card. */
const LIST_ID = 'product-list';

/** Skeleton cards while the products load: 8 (design.md of SHOP-7, S4.5, loading). */
const SKELETON_CARDS = 8;

/**
 * The results of S4 (`/[locale]/products`, design.md of SHOP-7, S4.3–S4.10): the dynamic hole of the page, inside its
 * `<Suspense>`, since it reads `searchParams` at request time and the catalog of the api with `cacheLife('catalog')`
 * (plan of SHOP-7, Architecture Decisions 8). Styles: `.product-filters`, `.product-grid`, `.product-empty`,
 * `.load-more` in src/styles/components.css.
 *
 * - The search S4.3 and the sort S4.4 of the URL, above the grid (ProductFilters). A wrong value of the URL is read as
 *   its default (AC22).
 * - The grid S4.5 holds `page × 24` products on sale that match the search, in the order chosen, each a card S4.6; no
 *   delete button (AC16).
 * - Under it, the progress line S4.9, and Load more S4.10 while products are left (AC21); both keep the search and the
 *   sort (AC22).
 * - No product, in place of the grid (S4.7, AC23): while searching, "Không tìm thấy sản phẩm nào cho “xyz”" and Clear
 *   search S4.8, back to S4 with no parameter; else "Chưa có sản phẩm nào.".
 * - The api fails: the DAL throws, and so does this component, to the error boundary of `[locale]`, the error state of
 *   S4.5 with its Try again; never an empty list (NFR26). A later block that fails leaves the products read before it,
 *   with the error line of S4.10.
 */
export async function ProductResults({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseProductQuery(await searchParams);
  const { items, totalItems, complete } = await getStoreProducts(query);
  const t = await getTranslations('Products');

  const filters = <ProductFilters query={query} />;

  if (items.length === 0) {
    return (
      <>
        {filters}
        <div className="product-empty">
          <p role="status">{query.q === '' ? t('empty') : t('noResults', { q: query.q })}</p>
          {query.q !== '' && <Link href="/products">{t('clearSearch')}</Link>}
        </div>
      </>
    );
  }

  const nextHref = nextProductsHref(query, { shown: items.length, totalItems, complete });

  return (
    <>
      {filters}
      <ul id={LIST_ID} className="product-grid" aria-label={t('list')}>
        {items.map((product) => (
          <li key={product.id}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
      <div className="load-more">
        <p role="status" aria-live="polite" className="load-more__progress">
          {t('progress', { shown: items.length, total: totalItems })}
        </p>
        <LoadMoreButton
          listId={LIST_ID}
          shown={items.length}
          nextHref={nextHref}
          failed={!complete}
        />
      </div>
    </>
  );
}

/**
 * What S4 shows while it reads the products: the place of the search and the sort, with no field to type into yet,
 * since the real ones replace it; then 8 skeleton cards in a busy list, with no words.
 */
export function ProductResultsSkeleton() {
  const t = useTranslations('Products');

  return (
    <>
      <div className="product-filters" aria-hidden="true">
        <span className="skeleton product-filters__search product-filters__skeleton" />
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
