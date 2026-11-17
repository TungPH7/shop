import * as z from 'zod';

import { parseSearchParams } from '~/lib/validation/parse-search-params';

/**
 * The query of S4 (`/[locale]/products`) in the URL (plan of SHOP-7, Architecture Decisions 11). `page` is how many
 * times 24 products were loaded: 1 by default, and then left out of the URL. US5b (SHOP-28) adds `q` and `sort`.
 *
 * The URL is user input: a wrong value falls back to its default, never an error (AC22).
 */

/** Products of each load: 1, 2, 3 and 4 columns all divide it (design.md, S4.5). */
export const PAGE_SIZE = 24;

const DEFAULT_PAGE = 1;

/** Digits only, so `1e3`, `0x10` or `1.5` are no page; past the safe integers, a page is no longer exact. */
const pageSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(Number.MAX_SAFE_INTEGER))
  .catch(DEFAULT_PAGE);

const productQuerySchema = z.object({
  page: pageSchema.optional().transform((page) => page ?? DEFAULT_PAGE),
});

export type ProductQuery = z.infer<typeof productQuerySchema>;

export function parseProductQuery(
  raw: Record<string, string | string[] | undefined>,
): ProductQuery {
  return parseSearchParams(productQuerySchema, raw);
}

/** The path of S4 for `query`, without its locale and without the defaults: for a link or `router.replace`. */
export function productsHref(query: ProductQuery): string {
  return query.page === DEFAULT_PAGE ? '/products' : `/products?page=${query.page}`;
}

/** What S4 shows of `query`: products shown, products on sale, and whether every block needed was read. */
export type ProductsShown = { shown: number; totalItems: number; complete: boolean };

/**
 * Where Load more (S4.10) goes from `query`, or null when every product is shown and there is no Load more.
 *
 * - After a failed block, the page of the URL again: the button is Try again.
 * - While products are left, the page after the whole loads of 24 shown.
 */
export function nextProductsHref(
  query: ProductQuery,
  { shown, totalItems, complete }: ProductsShown,
): string | null {
  if (!complete) return productsHref(query);
  if (shown >= totalItems) return null;
  return productsHref({ ...query, page: Math.ceil(shown / PAGE_SIZE) + 1 });
}
