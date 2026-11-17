import 'server-only';

import { cacheLife } from 'next/cache';

import {
  pageSchema,
  storeProductSummarySchema,
  type StoreProductSummary,
} from '~/features/product/model/product';
import { PAGE_SIZE, type ProductQuery } from '~/features/product/model/product-query';
import { httpGet } from '~/lib/http/client';
import { captureError } from '~/lib/monitoring/capture-error';

/** Products of each request to the api: under its limit of 100 (NFR3), and 4 loads of 24. */
const BLOCK_SIZE = 96;

const storeProductPageSchema = pageSchema(storeProductSummarySchema);

export type StoreProductList = {
  /** The first `page × 24` products on sale, newest first, each once. */
  items: StoreProductSummary[];
  /** How many products are on sale, for "Viewed 24 of 30 products" (S4.9). */
  totalItems: number;
  /** `false`: a block after the first failed, and `items` holds only the whole loads of 24 read before it. */
  complete: boolean;
};

/**
 * One block of 96 products on sale from `offset`: `GET /api/products`, newest first (plan of SHOP-7, API Contract).
 *
 * `cacheLife('catalog')`: data at most 25 s old on the server, a dynamic hole outside the prerender (Architecture
 * Decisions 8). The cache holds a block, not a page: the first four loads of 24 share the first block, so Load more on
 * them is served from the cache and the products already shown stay where they are. A throw is not cached.
 */
async function getStoreProductBlock(offset: number) {
  'use cache';
  cacheLife('catalog');

  return httpGet(`/api/products?offset=${offset}&limit=${BLOCK_SIZE}`, storeProductPageSchema);
}

/**
 * The products of S4 for `query`: `page × 24` products on sale, read in blocks of 96 (Architecture Decisions 10).
 *
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
 * at 10,000 products. Blocks stay in the cache for 25 s, so a later visitor pays nothing, and Load more on one page
 * reads at most one new block. Reading the blocks after the first in parallel, a few at a time, is the change to make if
 * the catalog grows that large.
 */
export async function getStoreProducts(query: ProductQuery): Promise<StoreProductList> {
  const wanted = query.page * PAGE_SIZE;
  const items: StoreProductSummary[] = [];
  const seen = new Set<string>();
  let totalItems = 0;

  for (let offset = 0; ; offset += BLOCK_SIZE) {
    let block: Awaited<ReturnType<typeof getStoreProductBlock>>;
    try {
      block = await getStoreProductBlock(offset);
    } catch (error) {
      if (offset === 0) throw error;
      captureError(error, { feature: 'product-list', offset });
      const whole = Math.floor(items.length / PAGE_SIZE) * PAGE_SIZE;
      return { items: items.slice(0, whole), totalItems, complete: false };
    }

    for (const item of block.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
    totalItems = Math.max(block.totalItems, items.length);

    // The whole catalog is read: past a short block, or past the total of the api, there is no product. The total is
    // then the products read, each once: a larger one, from a block read before the catalog moved, would offer a Load
    // more that never ends.
    if (block.items.length < BLOCK_SIZE || offset + BLOCK_SIZE >= block.totalItems) {
      return { items: items.slice(0, wanted), totalItems: items.length, complete: true };
    }
    if (items.length >= wanted) {
      return { items: items.slice(0, wanted), totalItems, complete: true };
    }
  }
}
