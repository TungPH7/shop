import { useTranslations } from 'next-intl';

import { PlaceholderTile } from '~/components/ui/placeholder-tile';
import {
  discountPercent,
  formatPrice,
  type StoreProductSummary,
} from '~/features/product/model/product';
import { Link } from '~/i18n/navigation';

/**
 * A card of the grid S4.5 (design.md of SHOP-7, S4.6): the whole card is one link to S5. Styles: `.product-card` in
 * src/styles/components.css.
 *
 * A screen reader reads the link as the name, the price, the original price, the discount and the stock, in that order:
 * so the stock badge comes last in the markup, and CSS lays it over the top left of the tile. The spaces between the
 * parts keep the words apart in the name of the link; CSS does not lay them out, since the card is a grid.
 */
export function ProductCard({ product }: { product: StoreProductSummary }) {
  const t = useTranslations('Products');
  const { compareAtPrice } = product;

  return (
    <Link href={`/products/${product.slug}`} className="card product-card">
      <PlaceholderTile id={product.id} name={product.name} />{' '}
      <span className="product-card__name">{product.name}</span>{' '}
      <span className="product-card__price">
        <span className="product-card__value">{formatPrice(product.price)}</span>
        {compareAtPrice !== null && (
          <>
            {' '}
            <span className="product-card__was">
              <span className="visually-hidden">{t('originalPrice')}</span>{' '}
              <s>{formatPrice(compareAtPrice)}</s>
            </span>{' '}
            <span className="badge badge--bad badge--plain">
              <span className="visually-hidden">{t('discount')}</span>{' '}
              {/* One text node, so a screen reader reads "-16%" and not "-", "16", "%". */}
              <span>{`-${discountPercent(product.price, compareAtPrice)}%`}</span>
            </span>
          </>
        )}
      </span>
      {product.availability === 'OUT_OF_STOCK' && (
        <>
          {' '}
          <span className="badge badge--warn product-card__stock">{t('outOfStock')}</span>
        </>
      )}
    </Link>
  );
}
