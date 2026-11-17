import { ProductNotFound } from '~/features/product/components/product-not-found';

/** S6 with HTTP 404, for a page load the Proxy rewrites here (AC26). */
export default function NotFound() {
  return <ProductNotFound />;
}
