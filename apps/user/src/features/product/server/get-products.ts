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

    if (block.items.length < BLOCK_SIZE) {
      // No product past a short block: a larger total would offer a Load more that never ends.
      return { items: items.slice(0, wanted), totalItems: items.length, complete: true };
    }
    if (items.length >= wanted || offset + BLOCK_SIZE >= block.totalItems) {
      return { items: items.slice(0, wanted), totalItems, complete: true };
    }
  }
}
