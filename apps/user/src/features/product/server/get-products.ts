import 'server-only';

import { cacheLife } from 'next/cache';
import type * as z from 'zod';

import {
  pageSchema,
  storeProductSummarySchema,
  type StoreProductSummary,
} from '~/features/product/model/product';
import {
  apiSortOf,
  CATALOG,
  foldKeyword,
  PAGE_SIZE,
  type ProductQuery,
  type ProductSort,
  type ProductSource,
} from '~/features/product/model/product-query';
import { isApiError } from '~/lib/http/api-error';
import { httpGet } from '~/lib/http/client';
import { captureError } from '~/lib/monitoring/capture-error';
import { isStoreSlug } from '~/lib/validation/store-slug';

/** Products of each request to the api: under its limit of 100 (NFR3), and 4 loads of 24. */
const BLOCK_SIZE = 96;

const storeProductPageSchema = pageSchema(storeProductSummarySchema);

type StoreProductPage = z.infer<typeof storeProductPageSchema>;

export type StoreProductList = {
  /** The first `page × 24` products on sale that match the search, in the order of the query, each once. */
  items: StoreProductSummary[];
  /**
   * How many products on sale match the search, for "Viewed 24 of 30 products" (S4.9): the total of the api, or, once
   * the whole catalog is read, the number of different products read.
   */
  totalItems: number;
  /** `false`: a block after the first failed, and `items` holds only the whole loads of 24 read before it. */
  complete: boolean;
};

/**
 * One block of 96 products on sale from `offset`: `GET /api/products` (plan of SHOP-7, API Contract), with the words
 * `terms` of the keyword when there is one (`foldKeyword`) and the order `sort`, always named so the api never picks a
 * default of its own.
 *
 * `cacheLife('catalog')`: data at most 25 s old on the server, a dynamic hole outside the prerender (Architecture
 * Decisions 8). The cache holds a block, not a page, of one search and one order: the first four loads of 24 share the
 * first block, so Load more on them is served from the cache and the products already shown stay where they are. Its
 * key is the folded words, never the keyword as typed: `A`, `á` and `a!`, one search at the api, are one entry here
 * too (review of PR #62). In an order other than relevance, which alone ranks the words as a phrase, the words come
 * sorted (`termsFor`), so `ao thun` and `thun ao` are one entry too (review of PR #64). A throw is not cached.
 */
async function getStoreProductBlock(terms: string, sort: ProductSort, offset: number) {
  'use cache';
  cacheLife('catalog');

  const params = new URLSearchParams();
  if (terms !== '') params.set('q', terms);
  params.set('sort', apiSortOf(sort));
  params.set('offset', String(offset));
  params.set('limit', String(BLOCK_SIZE));
  return httpGet(`/api/products?${params.toString()}`, storeProductPageSchema);
}

/**
 * One block of 96 products on sale of the visible category at `slug` from `offset`:
 * `GET /api/categories/{slug}/products` (plan of SHOP-81, API Contract), in the order `sort`, never relevance (AC13).
 * Cached as a block of the catalog is, under the stored slug of the category (Architecture Decisions 10). A throw, the
 * 404 of a category hidden or deleted included, is not cached.
 */
async function getCategoryProductBlock(slug: string, sort: ProductSort, offset: number) {
  'use cache';
  cacheLife('catalog');

  const params = new URLSearchParams();
  params.set('sort', apiSortOf(sort));
  params.set('offset', String(offset));
  params.set('limit', String(BLOCK_SIZE));
  return httpGet(`/api/categories/${slug}/products?${params.toString()}`, storeProductPageSchema);
}

/**
 * The words the api is asked for `q` in the order `sort`: the folded words (`foldKeyword`), as typed for relevance,
 * which ranks a name that holds them as a phrase first, and sorted for another order, which matches each word wherever
 * it is and so does not depend on their order.
 */
function termsFor(q: string, sort: ProductSort): string {
  const terms = foldKeyword(q);
  return sort === 'relevance' ? terms : terms.split(' ').sort().join(' ');
}

/**
 * The products of S4 for `query`: `page × 24` products on sale that match its keyword, in its order, read in blocks of
 * 96 (Architecture Decisions 10).
 *
 * - A keyword with no word, such as `%` or `!!!`, matches no product, as at the api (NFR10): the api is not asked.
 * - A product read twice, because the catalog moved between two blocks, is kept once (NFR18).
 * - Reading stops at the number of products on sale, so `page=999999` reads the catalog once and no further (NFR3); and
 *   at a block shorter than asked, past which there is no product.
 * - 5xx, no answer, past 5 s or a body that is not a page of products: throws, never an empty list (NFR26). When a
 *   block after the first fails, as Load more past the first 96 can, the products read before it are kept, cut to whole
 *   loads of 24, with `complete: false`: the page shows them and the error line of S4.10 rather than losing them. The
 *   error is reported, since the page does not throw it.
 *
 * Only GET (NFR8).
 *
 * The blocks are read one after another, on purpose (review of PR #48). Each block decides whether the next is needed,
 * by its length and its total, so a page never asks for a block past the catalog; one visitor holds at most one request
 * to the api at a time, whatever page the URL names (NFR3); and the products read before a failed block are exactly
 * the ones kept. The cost is at a large catalog with an empty cache: about 105 requests, some 21 s, for `page=999999`
 * at 10,000 products, or at as many products as a search matches. Blocks stay in the cache for 25 s under the order and
 * the folded words of the search, so within that time a later visitor of the same search, however its keyword is
 * written, pays nothing, and Load more on one page reads at most one new block. A search with other words, or the same
 * search after 25 s, pays again: the cache does not bound how often a visitor makes the api read a whole search, a
 * rate limit on `?q=` at the proxy would. Reading the blocks after the first in parallel, a few at a time, is the change
 * to make if the catalog grows that large.
 */
export async function getStoreProducts(query: ProductQuery): Promise<StoreProductList>;
/**
 * The products of S5 of SHOP-81 for `query`, when `source` is a category: `page × 24` products on sale of that category,
 * in the order of the query, read in blocks of 96 as for S4, with no keyword, since a category page has no search
 * (AC13). `null` when the api answers 404 for the first block, as for a category hidden or deleted since the page read
 * its name, and for a slug the api cannot hold, without a request (NFR9): the page then calls `notFound()`.
 */
export async function getStoreProducts(
  query: ProductQuery,
  source: ProductSource,
): Promise<StoreProductList | null>;
export async function getStoreProducts(
  query: ProductQuery,
  source: ProductSource = CATALOG,
): Promise<StoreProductList | null> {
  if (source.kind === 'category') {
    const { slug } = source;
    if (!isStoreSlug(slug)) return null;
    try {
      return await readProducts(
        (offset) => getCategoryProductBlock(slug, query.sort, offset),
        query.page,
        'category-products',
      );
    } catch (error) {
      if (isApiError(error) && error.kind === 'http' && error.status === 404) return null;
      throw error;
    }
  }

  const terms = termsFor(query.q, query.sort);
  if (query.q !== '' && terms === '') return { items: [], totalItems: 0, complete: true };
  return readProducts(
    (offset) => getStoreProductBlock(terms, query.sort, offset),
    query.page,
    'product-list',
  );
}

/**
 * `page × 24` products from the blocks `readBlock` gives, read one after another as getStoreProducts tells, each product
 * once. The error of the first block is thrown; the error of a later one is reported under `feature`, and the whole
 * loads of 24 read before it are kept, with `complete: false`.
 */
async function readProducts(
  readBlock: (offset: number) => Promise<StoreProductPage>,
  page: number,
  feature: string,
): Promise<StoreProductList> {
  const wanted = page * PAGE_SIZE;
  const items: StoreProductSummary[] = [];
  const seen = new Set<string>();
  let totalItems = 0;

  for (let offset = 0; ; offset += BLOCK_SIZE) {
    let block: StoreProductPage;
    try {
      block = await readBlock(offset);
    } catch (error) {
      if (offset === 0) throw error;
      captureError(error, { feature, offset });
      const whole = Math.floor(items.length / PAGE_SIZE) * PAGE_SIZE;
      return { items: items.slice(0, whole), totalItems, complete: false };
    }

    for (const item of block.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
    totalItems = Math.max(block.totalItems, items.length);

    // The whole list is read: past a short block, or past the total of the api, there is no product. The total is
    // then the products read, each once: a larger one, from a block read before the list moved, would offer a Load
    // more that never ends.
    if (block.items.length < BLOCK_SIZE || offset + BLOCK_SIZE >= block.totalItems) {
      return { items: items.slice(0, wanted), totalItems: items.length, complete: true };
    }
    if (items.length >= wanted) {
      return { items: items.slice(0, wanted), totalItems, complete: true };
    }
  }
}
