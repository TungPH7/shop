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

/**
 * Spaces as the api reads them, and more: JavaScript's `\s` lacks U+0085 and U+001C–U+001F, which the api strips, so
 * every control character counts as a space here. A keyword of control characters alone is then no search, never one
 * the api refuses (AC22).
 *
 * One difference with `ProductSearchTerms.of` of the api, on purpose: a run of control characters that are not spaces
 * there, such as U+0001, is one space here before the cut at 100, where the api keeps each one and counts it. So a
 * keyword holding them keeps a few more of its characters here than the api would keep of it. The page never sends
 * this keyword: it asks the api its folded words (`foldKeyword`), so this cut is the one that decides the search.
 */
const SPACES = /[\p{Cc}\s]+/gu;

const keywordSchema = z
  .string()
  .transform((q) => q.replace(SPACES, ' ').trim().slice(0, MAX_KEYWORD_LENGTH).trimEnd())
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

const COMBINING_MARKS = /[\u0300-\u036f]/g;
const NOT_LETTER_OR_DIGIT = /[^a-z0-9]+/g;

/**
 * The words of the keyword `q` as the api searches them (ADR-0002, `ProductSearchTerms`): folded as
 * `ProductSearchTerms.fold` and `app.search_fold` fold, step for step (NFD, no combining mark U+0300–U+036F, `đ` and
 * `Đ` to `d`, lower case, each run of characters other than a–z and 0–9 one space), each word once in the order of
 * its first time, joined by one space. Empty when `q` has no word, as `%` or `!!!`, which matches no product.
 *
 * `A`, `á` and `a!` are one search at the api, and so one search here: what the page asks the api and caches. The
 * field and S4.7 show the keyword as typed.
 */
export function foldKeyword(q: string): string {
  const folded = q
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(NOT_LETTER_OR_DIGIT, ' ')
    .trim();
  return folded === '' ? '' : [...new Set(folded.split(' '))].join(' ');
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
  return productsHref(parseProductQuery({ q: typed, sort: chosenSortOf(query) ?? undefined }));
}

/**
 * The sort the visitor chose in `query`, or null when it is the default of its keyword: the one sort a new search
 * keeps (S4.3), in the URL and in the hidden field of the search form.
 */
export function chosenSortOf(query: ProductQuery): ProductSort | null {
  return query.sort === defaultSort(query.q) ? null : query.sort;
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
