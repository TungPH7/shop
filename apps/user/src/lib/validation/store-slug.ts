/**
 * A slug the api can hold, for a product (`^[a-z0-9-]+$` since V3) or a category (V7), compared without case
 * (`citext`). Anything else, such as `..`, `/` or `%`, is no product and no category, so the Proxy and the DAL answer
 * it without a request, and a path such as `..%2Fadmin%2Fcategories` never reaches another path of the api (NFR9 of
 * SHOP-81). Shared by the Proxy and the DAL of `product` and `category` (plan of SHOP-81, Architecture Decisions 9).
 */
export function isStoreSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/i.test(slug);
}
