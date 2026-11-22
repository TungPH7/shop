'use client';

import { useTranslations } from 'next-intl';

import { StaticLink } from '~/i18n/static-link';

/**
 * S6 of SHOP-81, "Không tìm thấy danh mục" (design.md, S6.2–S6.4; AC16): one glass card in the middle of the page, as
 * S6 of SHOP-7, with no breadcrumb. The same for a slug that never existed, a hidden category and a deleted one, and one
 * sentence for the three, so no one learns a hidden category exists (NFR8). Two routes show it:
 * `/[locale]/category-not-found`, where the Proxy rewrites a page load with HTTP 404, and the not-found boundary of the
 * category page, for a client navigation. Styles: the `.product-not-found` card of S6 of SHOP-7 in
 * src/styles/components.css.
 *
 * A client component, as ProductNotFound: a not-found element renders apart from the layout that calls
 * `setRequestLocale`, so it reads the messages of the NextIntlClientProvider of the layout; the link is a StaticLink,
 * which does not read the path (SHOP-41).
 */
export function CategoryNotFound() {
  const t = useTranslations('CategoryNotFound');

  return (
    <main className="product-not-found">
      <div className="card product-not-found__card">
        <h1>{t('title')}</h1>
        <p>{t('description')}</p>
        <StaticLink className="btn btn--primary" href="/products">
          {t('viewAll')}
        </StaticLink>
      </div>
    </main>
  );
}
