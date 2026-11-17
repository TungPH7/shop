import { useTranslations } from 'next-intl';

import { StaticLink } from '~/i18n/static-link';

/**
 * S6, "Không tìm thấy sản phẩm" (design.md of SHOP-7, S6.2–S6.4; AC26): one glass card in the middle of the page, the
 * same for a slug that never existed, a hidden product and a deleted one, so no one learns a hidden product exists
 * (NFR9). Two routes show it: `/[locale]/product-not-found`, where the Proxy rewrites a page load with HTTP 404, and the
 * not-found boundary of the product detail page, for a client navigation. Styles: `.product-not-found` in
 * src/styles/components.css.
 *
 * The link is a StaticLink: it does not read the path, so the view renders anywhere, even in the boundary of a route
 * whose slug is known only at request time (SHOP-41).
 */
export function ProductNotFound() {
  const t = useTranslations('ProductNotFound');

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
