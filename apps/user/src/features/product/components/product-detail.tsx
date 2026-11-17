import { useTranslations } from 'next-intl';

import { PlaceholderTile } from '~/components/ui/placeholder-tile';
import {
  descriptionOf,
  discountPercent,
  formatPrice,
  type StoreProduct,
} from '~/features/product/model/product';
import { Link } from '~/i18n/navigation';

/**
 * S5, the product of the store (design.md of SHOP-7, S5.2–S5.10): a synchronous view, so a render test reaches it; the
 * page reads the product and gives it here. Styles: `.product-detail` in src/styles/components.css.
 *
 * The name and the description are text nodes, never HTML: `<b>` or `<script>` in them shows as typed (AC25, NFR11).
 * The description keeps the line breaks of the person who typed it through `white-space: pre-line`; one of spaces only
 * is none, as for the meta description (`descriptionOf`).
 */
export function ProductDetail({ product }: { product: StoreProduct }) {
  const t = useTranslations('ProductDetail');
  const { compareAtPrice } = product;
  const description = descriptionOf(product.description);
  const inStock = product.availability === 'IN_STOCK';

  return (
    <>
      <Link href="/products" className="back-link">
        <span aria-hidden="true">←</span> {t('back')}
      </Link>
      <article className="card product-detail">
        <PlaceholderTile id={product.id} name={product.name} variant="detail" />
        <div className="product-detail__body">
          <h1 className="product-detail__name">{product.name}</h1>
          <div className="well product-price">
            <p className="product-price__label">{t('price')}</p>
            <div className="product-price__row">
              <p className="product-price__value">{formatPrice(product.price)}</p>
              {compareAtPrice !== null && (
                <p className="product-price__was">
                  <span>
                    <span className="visually-hidden">{t('originalPrice')} </span>
                    <s>{formatPrice(compareAtPrice)}</s>
                  </span>
                  <span className="badge badge--bad badge--plain">
                    <span className="visually-hidden">{t('discount')} </span>
                    {/* One text node, so a screen reader reads "-20%" and not "-", "20", "%". */}
                    <span>{`-${discountPercent(product.price, compareAtPrice)}%`}</span>
                  </span>
                </p>
              )}
            </div>
          </div>
          <p>
            <span className={`badge ${inStock ? 'badge--good' : 'badge--warn'}`}>
              {t(inStock ? 'inStock' : 'outOfStock')}
            </span>
          </p>
          {description !== null && (
            <div className="product-detail__about">
              <h2>{t('description')}</h2>
              <p className="product-detail__description">{description}</p>
            </div>
          )}
        </div>
      </article>
    </>
  );
}

/** What the page shows while it reads the product: the shape of S5 in skeleton blocks, with no words. */
export function ProductDetailSkeleton() {
  return (
    <div className="card product-detail" aria-busy="true">
      <span className="skeleton product-detail__skeleton-tile" />
      <div className="product-detail__body">
        <span className="skeleton product-detail__skeleton-line" />
        <span className="skeleton product-detail__skeleton-well" />
        <span className="skeleton product-detail__skeleton-line" />
      </div>
    </div>
  );
}
