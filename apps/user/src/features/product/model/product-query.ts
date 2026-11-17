import * as z from 'zod';

import { parseSearchParams } from '~/lib/validation/parse-search-params';

/**
 * The query of S4 (`/[locale]/products`) in the URL (plan of SHOP-7, Architecture Decisions 11):
 * `?q=&sort=newest|price-asc|price-desc|relevance&page=N`.
 *
 * - `q` is the keyword of the search S4.3 (US5b, SHOP-28), without the spaces around and between its words and cut at
 *   100 characters, as the api cleans it (API Contract, Từ khóa `q`); empty is no search.
 * - `sort` is the order S4.4: the newest first by default, and relevance by default while searching. Relevance exists
 *   only while searching.
 * - `page` is how many times 24 products were loaded: 1 by default.
 *
 * A default is left out of the URL. The URL is user input: a wrong value falls back to its default, never an error
 * (AC22).
 */

/** Products of each load: 1, 2, 3 and 4 columns all divide it (design.md, S4.5). */
export const PAGE_SIZE = 24;

/** The longest keyword, in UTF-16 units as the api counts them (SPEC, Tìm theo tên). */
export const MAX_KEYWORD_LENGTH = 100;

const DEFAULT_PAGE = 1;

const SORTS = ['newest', 'price-asc', 'price-desc', 'relevance'] as const;

export type ProductSort = (typeof SORTS)[number];

/** Digits only, so `1e3`, `0x10` or `1.5` are no page; past the safe integers, a page is no longer exact. */
const pageSchema = z
  .string()
  .regex(/^\d+$/)
  .transform(Number)
  .pipe(z.number().int().min(1).max(Number.MAX_SAFE_INTEGER))
  .catch(DEFAULT_PAGE);

const keywordSchema = z
  .string()
  .transform((q) => q.trim().replace(/\s+/g, ' ').slice(0, MAX_KEYWORD_LENGTH).trimEnd())
  .catch('');

const productQuerySchema = z
  .object({
    q: keywordSchema.optional(),
    sort: z.enum(SORTS).optional().catch(undefined),
    page: pageSchema.optional(),
  })
  .transform(({ q = '', sort, page = DEFAULT_PAGE }) => ({
    q,
    sort: sort !== undefined && sortsFor(q).includes(sort) ? sort : defaultSort(q),
    page,
  }));

export type ProductQuery = { q: string; sort: ProductSort; page: number };

export function parseProductQuery(
  raw: Record<string, string | string[] | undefined>,
): ProductQuery {
  return parseSearchParams(productQuerySchema, raw);
}

/** The order of S4.4 when the URL names none: relevance while searching, else the newest first (SPEC, Sắp xếp). */
function defaultSort(q: string): ProductSort {
  return q === '' ? 'newest' : 'relevance';
}

/** The options of S4.4 for the keyword `q`: relevance only while searching (AC20). */
export function sortsFor(q: string): readonly ProductSort[] {
  return q === '' ? SORTS.filter((sort) => sort !== 'relevance') : SORTS;
}

const API_SORTS = {
  newest: 'NEWEST',
  'price-asc': 'PRICE_ASC',
  'price-desc': 'PRICE_DESC',
  relevance: 'RELEVANCE',
} as const satisfies Record<ProductSort, string>;

/** `sort` as `GET /api/products` names it (API Contract). */
export function apiSortOf(sort: ProductSort): (typeof API_SORTS)[ProductSort] {
  return API_SORTS[sort];
}

/** The path of S4 for `query`, without its locale and without the defaults: for a link or the router. */
export function productsHref({ q, sort, page }: ProductQuery): string {
  const params = new URLSearchParams();
  if (q !== '') params.set('q', q);
  if (sort !== defaultSort(q)) params.set('sort', sort);
  if (page !== DEFAULT_PAGE) params.set('page', String(page));
  const search = params.toString();
  return search === '' ? '/products' : `/products?${search}`;
}

/**
 * Where the search S4.3 goes with the words `typed`: the first 24 products of that keyword (AC18).
 *
 * A sort the visitor chose stays; one they did not choose was the default of the old keyword, and becomes the default
 * of the new one: relevance for a search. The search form sends the same fields without JavaScript (ProductFilters).
 */
export function searchHref(query: ProductQuery, typed: string): string {
  const chosen = query.sort === defaultSort(query.q) ? undefined : query.sort;
  return productsHref(parseProductQuery({ q: typed, sort: chosen }));
}

/** Where the sort S4.4 goes with `sort`: the first 24 products of the same search in that order. */
export function sortHref(query: ProductQuery, sort: ProductSort): string {
  return productsHref(parseProductQuery({ q: query.q, sort }));
}

/** What S4 shows of `query`: products shown, products on sale, and whether every block needed was read. */
export type ProductsShown = { shown: number; totalItems: number; complete: boolean };

/**
 * Where Load more (S4.10) goes from `query`, or null when every product is shown and there is no Load more. The search
 * and the sort stay (AC22).
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
