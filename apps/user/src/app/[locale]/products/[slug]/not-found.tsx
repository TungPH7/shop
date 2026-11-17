import { ProductNotFound } from '~/features/product/components/product-not-found';

/**
 * S6 when the page calls `notFound()`: on a client navigation to a product the api does not have. A page load of it
 * never gets here, since the Proxy rewrites it to `/[locale]/product-not-found` (AC26).
 */
export default function NotFound() {
  return <ProductNotFound />;
}
