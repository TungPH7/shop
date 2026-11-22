import 'server-only';

import { cacheLife } from 'next/cache';

import { storeProductSchema, type StoreProduct } from '~/features/product/model/product';
import { isApiError } from '~/lib/http/api-error';
import { httpGet } from '~/lib/http/client';
import { isStoreSlug } from '~/lib/validation/store-slug';

/**
 * The product of the store at `slug`, for S5 (US6a): `GET /api/products/{slug}`, which finds only products on sale and
 * compares the slug without case (plan of SHOP-7, API Contract).
 *
 * - 404: `null`, the same for a slug that never existed, a hidden product and a deleted one (NFR9). The page then calls
 *   `notFound()`. The `null` is cached like a product, so a product shown again appears within the 60 s of NFR7.
 * - 5xx, no answer, past 5 s or a body that is not a `StoreProduct`: throws, never `null`, so the page is an error and
 *   not a 404 a search engine would drop (NFR26). A throw is not cached.
 *
 * `cacheLife('catalog')`: data at most 25 s old on the server, a dynamic hole outside the prerender (Architecture
 * Decisions 8), so the page reads it inside a `<Suspense>`.
 */
export async function getStoreProduct(slug: string): Promise<StoreProduct | null> {
  'use cache';
  cacheLife('catalog');

  if (!isStoreSlug(slug)) return null;

  try {
    return await httpGet(`/api/products/${slug}`, storeProductSchema);
  } catch (error) {
    if (isApiError(error) && error.kind === 'http' && error.status === 404) return null;
    throw error;
  }
}
