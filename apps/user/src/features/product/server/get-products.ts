import 'server-only';

import { cacheLife } from 'next/cache';

import {
  pageSchema,
  storeProductSummarySchema,
  type StoreProductSummary,
} from '~/features/product/model/product';
import { PAGE_SIZE, type ProductQuery } from '~/features/product/model/product-query';
import { httpGet } from '~/lib/http/client';

/** Products of each request to the api: under its limit of 100 (NFR3), and 4 loads of 24. */
const BLOCK_SIZE = 96;

const storeProductPageSchema = pageSchema(storeProductSummarySchema);

export type StoreProductList = {
  /** The first `page × 24` products on sale, newest first, each once. */
  items: StoreProductSummary[];
  /** How many products are on sale, for "Viewed 24 of 30 products" (S4.9). */
  totalItems: number;
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
 * - 5xx, no answer, past 5 s or a body that is not a page of products: throws, never an empty list (NFR26).
 *
 * Only GET (NFR8).
 */
export async function getStoreProducts(query: ProductQuery): Promise<StoreProductList> {
  const wanted = query.page * PAGE_SIZE;
  const items: StoreProductSummary[] = [];
  const seen = new Set<string>();

  for (let offset = 0; ; offset += BLOCK_SIZE) {
    const block = await getStoreProductBlock(offset);
    for (const item of block.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }

    if (block.items.length < BLOCK_SIZE) {
      return { items: items.slice(0, wanted), totalItems: items.length };
    }
    if (items.length >= wanted || offset + BLOCK_SIZE >= block.totalItems) {
      return {
        items: items.slice(0, wanted),
        totalItems: Math.max(block.totalItems, items.length),
      };
    }
  }
}
