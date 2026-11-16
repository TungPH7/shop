/**
 * The results of S4 (`/[locale]/products`): the dynamic hole of the page, inside its `<Suspense>`, since it reads
 * `searchParams` at request time and, from US5a (SHOP-25), the catalog of the api with `cacheLife('catalog')`.
 *
 * Only a frame until then: the product demo of the template, with its NestJS API, delete button, count badge, density,
 * view and zoom, is gone (TW4 of SHOP-7), and `user` sends no product write (NFR8).
 */
export async function ProductResults({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await searchParams;
  return null;
}
