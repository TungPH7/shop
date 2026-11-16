import { expect, test } from 'vitest';

import { CACHE_LIFE_PROFILES } from '~/config/cache-life';

test('the catalog profile is the one of the plan of SHOP-7 (Architecture Decisions 8)', () => {
  expect(CACHE_LIFE_PROFILES.catalog).toEqual({ stale: 30, revalidate: 10, expire: 25 });
});

test('a catalog change reaches the customer within 60 seconds (NFR7): server expire plus browser stale', () => {
  const { stale, expire } = CACHE_LIFE_PROFILES.catalog;
  expect(stale + expire).toBeLessThanOrEqual(60);
});

test('the catalog data stays out of the prerender: expire is under 5 minutes, so no build reaches the api', () => {
  expect(CACHE_LIFE_PROFILES.catalog.expire).toBeLessThan(300);
});
