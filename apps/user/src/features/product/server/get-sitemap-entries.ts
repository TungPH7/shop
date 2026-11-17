import 'server-only';

import { cacheLife } from 'next/cache';

import {
  pageSchema,
  sitemapEntrySchema,
  type SitemapEntry,
} from '~/features/product/model/product';
import { httpGet } from '~/lib/http/client';

/** Products of each request to the api: its largest `limit` (plan of SHOP-7, API Contract). */
const BLOCK_SIZE = 1000;

const sitemapPageSchema = pageSchema(sitemapEntrySchema);

/**
 * One block of 1,000 products on sale from `offset`: `GET /api/sitemap/products`, in the order of their id.
 *
 * `cacheLife('catalog')`: data at most 25 s old on the server, so a product hidden or deleted leaves the sitemap within
 * the 60 s of NFR7 and NFR21. A throw is not cached.
 */
async function getSitemapBlock(offset: number) {
  'use cache';
  cacheLife('catalog');

  return httpGet(`/api/sitemap/products?offset=${offset}&limit=${BLOCK_SIZE}`, sitemapPageSchema);
}

/**
 * Every product on sale, for `/sitemap.xml` (US6c, AC28): each block of 1,000, read one after the other up to the
 * number of products on sale, or to a block shorter than asked.
 *
 * - The api returns only products on sale (NFR9), so a hidden product is never here.
 * - A product read twice, because one was added between two blocks, is kept once.
 * - 5xx, no answer, past 5 s or a body that is not a page of entries, in any block: throws, never a sitemap short of
 *   products, which a search engine would read as products gone (NFR26).
 *
 * Only GET (NFR8).
 */
export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];
  const seen = new Set<string>();

  for (let offset = 0; ; offset += BLOCK_SIZE) {
    const block = await getSitemapBlock(offset);

    for (const entry of block.items) {
      if (seen.has(entry.slug)) continue;
      seen.add(entry.slug);
      entries.push(entry);
    }

    if (block.items.length < BLOCK_SIZE || offset + BLOCK_SIZE >= block.totalItems) return entries;
  }
}
