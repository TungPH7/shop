import { useTranslations } from 'next-intl';
import { getTranslations } from 'next-intl/server';

import { LoadMoreButton } from '~/features/product/components/load-more-button';
import { ProductCard } from '~/features/product/components/product-card';
import { PAGE_SIZE, parseProductQuery, productsHref } from '~/features/product/model/product-query';
import { getStoreProducts } from '~/features/product/server/get-products';

/** The id of the grid, for Load more to move the focus to the first new card. */
const LIST_ID = 'product-list';

/** Skeleton cards while the products load: 8 (design.md of SHOP-7, S4.5, loading). */
const SKELETON_CARDS = 8;

/**
 * The results of S4 (`/[locale]/products`, design.md of SHOP-7, S4.5–S4.10): the dynamic hole of the page, inside its
 * `<Suspense>`, since it reads `searchParams` at request time and the catalog of the api with `cacheLife('catalog')`
 * (plan of SHOP-7, Architecture Decisions 8). Styles: `.product-grid`, `.load-more` in src/styles/components.css.
 *
 * - The grid S4.5 holds `page × 24` products on sale, newest first, each a card S4.6; no delete button (AC16).
 * - Under it, the progress line S4.9, and Load more S4.10 while products are left (AC21).
 * - No product: "Chưa có sản phẩm nào." (S4.7) in place of the grid.
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

  if (items.length === 0) {
    return (
      <p role="status" className="product-empty">
        {t('empty')}
      </p>
    );
  }

  // After a failed block, Load more asks again for the page of the URL; otherwise for the page after the one shown.
  const shownPage = Math.ceil(items.length / PAGE_SIZE);
  const nextHref = !complete
    ? productsHref(query)
    : items.length < totalItems
      ? productsHref({ ...query, page: shownPage + 1 })
      : null;

  return (
    <>
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

/** What S4 shows while it reads the products: 8 skeleton cards in a busy list, with no words. */
export function ProductResultsSkeleton() {
  const t = useTranslations('Products');

  return (
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
  );
}
