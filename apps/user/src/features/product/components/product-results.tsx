import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { LoadMoreButton } from '~/features/product/components/load-more-button';
import { ProductCard } from '~/features/product/components/product-card';
import { ProductFilters } from '~/features/product/components/product-filters';
import {
  CATALOG,
  nextProductsHref,
  parseCategoryProductQuery,
  parseProductQuery,
  type ProductSource,
} from '~/features/product/model/product-query';
import { getStoreProducts } from '~/features/product/server/get-products';
import { Link } from '~/i18n/navigation';

/** The id of the grid, for Load more to move the focus to the first new card. */
const LIST_ID = 'product-list';

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
 *
 * The same results serve the page of a category (`source`, S5.4–S5.10 of SHOP-81), with the products on sale of that
 * category: the sort with no search and no relevance (AC13), the grid, the progress line and Load more on the path of
 * the category (AC14). With no product on sale, "Chưa có sản phẩm nào trong danh mục này." and View all products
 * replace the sort and the grid (S5.9, S5.10, AC15). A category hidden or deleted since the page read its name:
 * `notFound()`, the same S6 as for a slug that never existed (AC16).
 */
export async function ProductResults({
  searchParams,
  source = CATALOG,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  source?: ProductSource;
}) {
  const raw = await searchParams;
  const isCategory = source.kind === 'category';
  const query = isCategory ? parseCategoryProductQuery(raw) : parseProductQuery(raw);
  const list = isCategory ? await getStoreProducts(query, source) : await getStoreProducts(query);
  if (list === null) notFound();
  const { items, totalItems, complete } = list;
  const t = await getTranslations('Products');

  if (items.length === 0 && isCategory) {
    const tCategory = await getTranslations('Category');
    return (
      <div className="product-empty">
        <p role="status">{tCategory('empty')}</p>
        <Link className="btn btn--primary" href="/products">
          {tCategory('viewAll')}
        </Link>
      </div>
    );
  }

  const filters = <ProductFilters query={query} source={source} />;

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

  const nextHref = nextProductsHref(query, { shown: items.length, totalItems, complete }, source);

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
