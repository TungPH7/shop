import { getTranslations } from 'next-intl/server';
import { connection } from 'next/server';

import type { StoreCategory } from '~/features/category/model/category';
import { getStoreCategories } from '~/features/category/server/get-categories';
import { Link } from '~/i18n/navigation';
import { captureError } from '~/lib/monitoring/capture-error';

/**
 * The row of category links of the products page (design.md of SHOP-81, S7.3 and S7.4; AC17): the visible label
 * "Danh mục", then one small secondary button per visible category with a product on sale, by name A→Z as the api
 * orders them, each a real `<a href>` to its page in the locale of the page, with no parameter and no count of products.
 * Styles: `.category-links` in src/styles/components.css.
 *
 * An async Server Component that the products page puts in the same `<Suspense>` as its results, so both requests to the
 * api run side by side and the row shows with the grid, never pushing it down after (NFR4; plan of SHOP-81,
 * Architecture Decisions 11).
 *
 * No category: no row, no empty space. The api fails, as when it is down or is the api of `v0.3.0` after a rollback:
 * no row either, and the error is reported; the products page still shows, since the row is only a shortcut (NFR19,
 * NFR20). The DAL throws, and a throw is not cached, so the row comes back on the next read.
 *
 * The `<nav>` is named by `aria-label`, which says what the visible label says; the visible label is hidden from screen
 * readers, so they do not read it twice. Names are text nodes, never HTML (NFR10).
 */
export async function CategoryLinks() {
  // Request time only, before the read: the row reads no runtime data of its own, so without it the prerender would
  // call the api, and the catch below would swallow the signal Next uses to leave the row out of the static shell.
  await connection();

  let categories: StoreCategory[];
  try {
    categories = await getStoreCategories();
  } catch (error) {
    captureError(error, { feature: 'category-links' });
    return null;
  }
  if (categories.length === 0) return null;

  const t = await getTranslations('Products');

  return (
    <nav aria-label={t('categories')} className="category-links">
      <p className="category-links__label" aria-hidden="true">
        {t('categories')}
      </p>
      <ul className="category-links__list">
        {categories.map((category) => (
          <li key={category.slug}>
            <Link
              className="btn btn--secondary btn--sm category-links__link"
              href={`/categories/${category.slug}`}
            >
              {category.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
