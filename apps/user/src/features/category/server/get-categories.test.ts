// @vitest-environment node
// The DAL reads env.API_URL, a server variable: node, as get-product.test.ts. MSW answers at the network boundary, and
// fails the test on any request without a handler (onUnhandledRequest: 'error'): so a slug answered without a request
// sends none, and a method other than GET, as a POST or a DELETE, would fail the test too (NFR7).
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';

import { server } from '~/testing/msw/server';

import { getCategorySitemapEntries, getStoreCategories, getStoreCategory } from './get-categories';

// `'use cache'` is a directive Next compiles; outside Next it is a plain string. cacheLife only works inside Next, so the
// test checks the DAL picks the catalog profile (NFR6).
const { cacheLife } = vi.hoisted(() => ({ cacheLife: vi.fn() }));
vi.mock('next/cache', () => ({ cacheLife }));

const BASE = 'https://api.example.test';

const notFoundBody = {
  type: 'https://docs.example.com/errors/CATEGORY_NOT_FOUND',
  title: 'Category not found',
  status: 404,
  detail: 'Category not found.',
  instance: '/api/categories/khong-co',
  code: 'CATEGORY_NOT_FOUND',
};

/** The time limit of 5 s, already fired: its timer is not one fake timers reach (client.test.ts). */
function expireTimeLimit() {
  return vi
    .spyOn(AbortSignal, 'timeout')
    .mockReturnValue(
      AbortSignal.abort(new DOMException('The operation timed out.', 'TimeoutError')),
    );
}

describe('getStoreCategory', () => {
  test('returns the category of the slug, read with the catalog cache profile', async () => {
    server.use(
      http.get(`${BASE}/api/categories/ao`, () => HttpResponse.json({ name: 'Áo', slug: 'ao' })),
    );

    await expect(getStoreCategory('ao')).resolves.toEqual({ name: 'Áo', slug: 'ao' });
    expect(cacheLife).toHaveBeenCalledWith('catalog');
  });

  test('returns the stored slug, whatever case the path has (AC18)', async () => {
    server.use(
      http.get(`${BASE}/api/categories/AO`, () => HttpResponse.json({ name: 'Áo', slug: 'ao' })),
    );

    await expect(getStoreCategory('AO')).resolves.toEqual({ name: 'Áo', slug: 'ao' });
  });

  test('returns null when the api answers 404: a slug that never existed, a hidden or a deleted category (AC16)', async () => {
    server.use(
      http.get(`${BASE}/api/categories/khong-co`, () =>
        HttpResponse.json(notFoundBody, {
          status: 404,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    );

    await expect(getStoreCategory('khong-co')).resolves.toBeNull();
  });

  // As the page reads it in `params`: `%2F` is a `/` once decoded, and a malformed escape as `%E0` stays as typed.
  test.each(['..', '/', '../admin/categories', '%E0', 'a b', 'áo', ''])(
    'returns null for the slug %j without asking the api (NFR9)',
    async (slug) => {
      await expect(getStoreCategory(slug)).resolves.toBeNull();
    },
  );

  test('throws when the api answers 500, never null (NFR20)', async () => {
    server.use(
      http.get(`${BASE}/api/categories/ao`, () => new HttpResponse(null, { status: 500 })),
    );

    await expect(getStoreCategory('ao')).rejects.toMatchObject({ kind: 'http', status: 500 });
  });

  test('throws when the api cannot be reached', async () => {
    server.use(http.get(`${BASE}/api/categories/ao`, () => HttpResponse.error()));

    await expect(getStoreCategory('ao')).rejects.toMatchObject({ kind: 'network' });
  });

  test('throws when the api takes more than 5 s (NFR20)', async () => {
    const timeout = expireTimeLimit();
    server.use(
      http.get(`${BASE}/api/categories/ao`, async () => {
        await delay('infinite');
        return HttpResponse.json({ name: 'Áo', slug: 'ao' });
      }),
    );

    await expect(getStoreCategory('ao')).rejects.toMatchObject({ kind: 'timeout' });
    expect(timeout).toHaveBeenCalledWith(5000);
  });

  test('throws when the body is not a StoreCategory', async () => {
    server.use(http.get(`${BASE}/api/categories/ao`, () => HttpResponse.json({ name: 'Áo' })));

    await expect(getStoreCategory('ao')).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('getStoreCategories', () => {
  test('returns the categories of the links of S7 in the order of the api, read with the catalog cache profile', async () => {
    const items = [
      { name: 'Áo khoác', slug: 'ao-khoac' },
      { name: 'Bao tay', slug: 'bao-tay' },
    ];
    server.use(http.get(`${BASE}/api/categories`, () => HttpResponse.json({ items })));

    await expect(getStoreCategories()).resolves.toEqual(items);
    expect(cacheLife).toHaveBeenCalledWith('catalog');
  });

  test('returns an empty list when no category has a product on sale', async () => {
    server.use(http.get(`${BASE}/api/categories`, () => HttpResponse.json({ items: [] })));

    await expect(getStoreCategories()).resolves.toEqual([]);
  });

  test('throws when the api answers 500, never an empty list (NFR20)', async () => {
    server.use(http.get(`${BASE}/api/categories`, () => new HttpResponse(null, { status: 500 })));

    await expect(getStoreCategories()).rejects.toMatchObject({ kind: 'http', status: 500 });
  });

  test('throws when the api answers 404, as the api of v0.3.0 does after a rollback (NFR19)', async () => {
    server.use(http.get(`${BASE}/api/categories`, () => new HttpResponse(null, { status: 404 })));

    await expect(getStoreCategories()).rejects.toMatchObject({ kind: 'http', status: 404 });
  });

  test('throws when the api takes more than 5 s (NFR20)', async () => {
    expireTimeLimit();
    server.use(
      http.get(`${BASE}/api/categories`, async () => {
        await delay('infinite');
        return HttpResponse.json({ items: [] });
      }),
    );

    await expect(getStoreCategories()).rejects.toMatchObject({ kind: 'timeout' });
  });

  test('throws when the body is not an ItemList of StoreCategory', async () => {
    server.use(
      http.get(`${BASE}/api/categories`, () => HttpResponse.json([{ name: 'Áo', slug: 'ao' }])),
    );

    await expect(getStoreCategories()).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('getCategorySitemapEntries', () => {
  test('returns the categories of the sitemap with their last edit, read with the catalog cache profile', async () => {
    const items = [{ slug: 'ao', updatedAt: '2026-11-22T02:15:30.000Z' }];
    server.use(http.get(`${BASE}/api/sitemap/categories`, () => HttpResponse.json({ items })));

    await expect(getCategorySitemapEntries()).resolves.toEqual(items);
    expect(cacheLife).toHaveBeenCalledWith('catalog');
  });

  test('throws when the api answers 500, never a sitemap short of categories (NFR20)', async () => {
    server.use(
      http.get(`${BASE}/api/sitemap/categories`, () => new HttpResponse(null, { status: 500 })),
    );

    await expect(getCategorySitemapEntries()).rejects.toMatchObject({ kind: 'http', status: 500 });
  });

  test('throws when the api takes more than 5 s (NFR20)', async () => {
    expireTimeLimit();
    server.use(
      http.get(`${BASE}/api/sitemap/categories`, async () => {
        await delay('infinite');
        return HttpResponse.json({ items: [] });
      }),
    );

    await expect(getCategorySitemapEntries()).rejects.toMatchObject({ kind: 'timeout' });
  });

  test('throws when an entry has no last edit', async () => {
    server.use(
      http.get(`${BASE}/api/sitemap/categories`, () =>
        HttpResponse.json({ items: [{ slug: 'ao' }] }),
      ),
    );

    await expect(getCategorySitemapEntries()).rejects.toMatchObject({ kind: 'validation' });
  });
});
