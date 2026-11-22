import 'server-only';

import { cacheLife } from 'next/cache';

import {
  categorySitemapEntrySchema,
  itemListSchema,
  storeCategorySchema,
  type CategorySitemapEntry,
  type StoreCategory,
} from '~/features/category/model/category';
import { isApiError } from '~/lib/http/api-error';
import { httpGet } from '~/lib/http/client';
import { isStoreSlug } from '~/lib/validation/store-slug';

/**
 * The DAL of the categories of the store (plan of SHOP-81, API Contract). Every read:
 *
 * - is a GET of the api of the customer, never `/api/admin/**` (NFR7);
 * - uses `cacheLife('catalog')`: data at most 25 s old on the server, a dynamic hole outside the prerender, so a page
 *   reads it inside a `<Suspense>` and `next build` never calls the api (NFR6);
 * - throws on 5xx, no answer, past 5 s or a body of the wrong shape, never an empty answer (NFR20). A throw is not
 *   cached, so the next read asks the api again.
 */

const storeCategoryListSchema = itemListSchema(storeCategorySchema);
const categorySitemapSchema = itemListSchema(categorySitemapEntrySchema);

/**
 * The visible category at `slug`, for S5 (AC12–AC16): `GET /api/categories/{slug}`, which compares the slug without
 * case and answers a visible category even with no product on sale (AC15).
 *
 * - 404: `null`, the same for a slug that never existed, a hidden category and a deleted one (AC16, NFR8). The page
 *   then calls `notFound()`. The `null` is cached like a category, so a category shown again appears within 60 s.
 * - A slug the api cannot hold, such as `..` or `/`: `null` without a request (NFR9).
 */
export async function getStoreCategory(slug: string): Promise<StoreCategory | null> {
  'use cache';
  cacheLife('catalog');

  if (!isStoreSlug(slug)) return null;

  try {
    return await httpGet(`/api/categories/${slug}`, storeCategorySchema);
  } catch (error) {
    if (isApiError(error) && error.kind === 'http' && error.status === 404) return null;
    throw error;
  }
}

/**
 * The categories of the links of S7 (AC17): visible ones with at least one product on sale, by name A→Z in Vietnamese,
 * as the api orders them; the page does not sort them again.
 */
export async function getStoreCategories(): Promise<StoreCategory[]> {
  'use cache';
  cacheLife('catalog');

  const { items } = await httpGet('/api/categories', storeCategoryListSchema);
  return items;
}

/**
 * The categories of `/sitemap.xml` (AC19): visible ones with at least one product on sale, each with its last edit or
 * the last edit of one of its products on sale, the later.
 */
export async function getCategorySitemapEntries(): Promise<CategorySitemapEntry[]> {
  'use cache';
  cacheLife('catalog');

  const { items } = await httpGet('/api/sitemap/categories', categorySitemapSchema);
  return items;
}
