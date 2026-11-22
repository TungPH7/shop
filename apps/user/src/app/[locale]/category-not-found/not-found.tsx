import { CategoryNotFound } from '~/features/category/components/category-not-found';

/** S6 with HTTP 404, for a page load the Proxy rewrites here (AC16). */
export default function NotFound() {
  return <CategoryNotFound />;
}
