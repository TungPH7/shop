import { CategoryNotFound } from '~/features/category/components/category-not-found';

/**
 * S6 when the category page calls `notFound()`: on a client navigation to a category the api does not have. A page load
 * of it never gets here, since the Proxy rewrites it to `/[locale]/category-not-found` (AC16).
 */
export default function NotFound() {
  return <CategoryNotFound />;
}
