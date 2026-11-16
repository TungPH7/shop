// @vitest-environment node
// The DAL reads env.API_URL, a server variable: node, as get-product.test.ts. MSW answers at the network boundary, and
// fails the test on any request without a handler (onUnhandledRequest: 'error'), so a POST or DELETE would fail it too.
import { http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';

import { server } from '~/testing/msw/server';

import { getStoreProducts } from './get-products';

const { cacheLife } = vi.hoisted(() => ({ cacheLife: vi.fn() }));
vi.mock('next/cache', () => ({ cacheLife }));

const URL_ = 'https://api.example.test/api/products';

/** The n-th product of a catalog, newest first: a valid UUIDv7 whose last digits are n. */
const product = (n: number) => ({
  id: `0193a2b5-0000-7000-8000-${n.toString(16).padStart(12, '0')}`,
  name: `Sản phẩm ${n}`,
  slug: `san-pham-${n}`,
  price: 100000 + n,
  compareAtPrice: null,
  availability: 'IN_STOCK',
});

const catalog = (size: number) => Array.from({ length: size }, (_, i) => product(i + 1));

/** Serves `items` as `GET /api/products?offset=&limit=` does, and records each offset and limit asked. */
function serve(items: ReturnType<typeof product>[], totalItems = items.length) {
  const asked: { offset: number; limit: number }[] = [];
  server.use(
    http.get(URL_, ({ request }) => {
      const params = new URL(request.url).searchParams;
      const offset = Number(params.get('offset'));
      const limit = Number(params.get('limit'));
      asked.push({ offset, limit });
      return HttpResponse.json({
        items: items.slice(offset, offset + limit),
        totalItems,
        offset,
        limit,
      });
    }),
  );
  return asked;
}

const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe('getStoreProducts', () => {
  test('reads the first 24 products of a block of 96, with the catalog cache profile', async () => {
    const asked = serve(catalog(30));

    const result = await getStoreProducts({ page: 1 });

    expect(asked).toEqual([{ offset: 0, limit: 96 }]);
    expect(ids(result.items)).toEqual(ids(catalog(24)));
    expect(result.totalItems).toBe(30);
    expect(cacheLife).toHaveBeenCalledWith('catalog');
  });

  test('reads page × 24 products in blocks of 96, under the limit of 100 of the api (NFR3)', async () => {
    const asked = serve(catalog(300));

    const result = await getStoreProducts({ page: 5 });

    expect(asked).toEqual([
      { offset: 0, limit: 96 },
      { offset: 96, limit: 96 },
    ]);
    expect(ids(result.items)).toEqual(ids(catalog(120)));
    expect(result.totalItems).toBe(300);
  });

  test('keeps a product once when it moved into the next block between two reads (NFR18)', async () => {
    // A product added between the two reads pushes the 96th product of the first block to the head of the second.
    const first = catalog(96);
    const second = [product(96), ...catalog(150).slice(96)];
    server.use(
      http.get(URL_, ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get('offset'));
        const items = offset === 0 ? first : second.slice(0, 96);
        return HttpResponse.json({ items, totalItems: 151, offset, limit: 96 });
      }),
    );

    const result = await getStoreProducts({ page: 6 });

    expect(new Set(ids(result.items)).size).toBe(result.items.length);
    expect(ids(result.items)).toEqual(ids(catalog(144)));
  });

  test('stops at the number of products on sale, however large the page (NFR3)', async () => {
    const asked = serve(catalog(150));

    const result = await getStoreProducts({ page: 999999 });

    expect(asked).toEqual([
      { offset: 0, limit: 96 },
      { offset: 96, limit: 96 },
    ]);
    expect(result.items).toHaveLength(150);
    expect(result.totalItems).toBe(150);
  });

  test('stops at a block shorter than asked, and counts what it read, when the catalog shrank since the total was counted', async () => {
    const asked = serve(catalog(100), 400);

    const result = await getStoreProducts({ page: 10 });

    expect(asked).toHaveLength(2);
    expect(result.items).toHaveLength(100);
    // No more products past the short block: a total of 400 would offer a Load more that never ends.
    expect(result.totalItems).toBe(100);
  });

  test('returns no product and a total of 0 for an empty catalog', async () => {
    const asked = serve([]);

    await expect(getStoreProducts({ page: 1 })).resolves.toEqual({ items: [], totalItems: 0 });
    expect(asked).toHaveLength(1);
  });

  test('throws when the api answers 500, never an empty list (NFR26)', async () => {
    server.use(http.get(URL_, () => new HttpResponse(null, { status: 500 })));

    await expect(getStoreProducts({ page: 1 })).rejects.toMatchObject({
      kind: 'http',
      status: 500,
    });
  });

  test('throws when the api cannot be reached, never an empty list (NFR26)', async () => {
    server.use(http.get(URL_, () => HttpResponse.error()));

    await expect(getStoreProducts({ page: 1 })).rejects.toMatchObject({ kind: 'network' });
  });

  test('throws when the body is not a page of StoreProductSummary', async () => {
    server.use(
      http.get(URL_, () =>
        HttpResponse.json({ items: [{ ...product(1), price: '100001' }], totalItems: 1 }),
      ),
    );

    await expect(getStoreProducts({ page: 1 })).rejects.toMatchObject({ kind: 'validation' });
  });
});
