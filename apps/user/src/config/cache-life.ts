import type { NextConfig } from 'next';

/**
 * The cache profiles of `cacheLife` (Cache Components), set in `next.config.ts` and named in `cacheLife('<name>')`.
 *
 * `catalog` is for every read of the product catalog (plan of SHOP-7, Architecture Decisions 8): the server serves data
 * at most 25 s old (`expire`), and the router cache of the browser keeps a page at most 30 s (`stale`, the lowest Next
 * 16.4.6 allows), so a change reaches the customer within 55 s, under the 60 s of NFR7. With `expire` under 5 minutes,
 * the data is a dynamic hole outside the prerender: every read sits in a `<Suspense>`, and `next build` never calls the
 * api.
 *
 * A relative import from `next.config.ts`, like `security-headers.ts`: no `~` alias and no runtime dependency here.
 */
export const CACHE_LIFE_PROFILES = {
  catalog: { stale: 30, revalidate: 10, expire: 25 },
} as const satisfies NonNullable<NextConfig['cacheLife']>;
