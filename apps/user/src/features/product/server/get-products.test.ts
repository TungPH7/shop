// @vitest-environment node
// The DAL reads env.API_URL, a server variable: node, as get-product.test.ts. MSW answers at the network boundary, and
// fails the test on any request without a handler (onUnhandledRequest: 'error'), so a POST or DELETE would fail it too.
import { http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';

import { server } from '~/testing/msw/server';

import { getStoreProducts } from './get-products';

const { cacheLife, captureError } = vi.hoisted(() => ({
  cacheLife: vi.fn(),
  captureError: vi.fn(),
}));
vi.mock('next/cache', () => ({ cacheLife }));
vi.mock('~/lib/monitoring/capture-error', () => ({ captureError }));

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

    const result = await getStoreProducts({ q: '', sort: 'newest', page: 1 });

    expect(asked).toEqual([{ offset: 0, limit: 96 }]);
    expect(ids(result.items)).toEqual(ids(catalog(24)));
    expect(result.totalItems).toBe(30);
    expect(cacheLife).toHaveBeenCalledWith('catalog');
  });

  test('reads page × 24 products in blocks of 96, under the limit of 100 of the api (NFR3)', async () => {
    const asked = serve(catalog(300));

    const result = await getStoreProducts({ q: '', sort: 'newest', page: 5 });

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

    const result = await getStoreProducts({ q: '', sort: 'newest', page: 6 });

    expect(new Set(ids(result.items)).size).toBe(result.items.length);
    expect(ids(result.items)).toEqual(ids(catalog(144)));
  });

  test('stops at the number of products on sale, however large the page (NFR3)', async () => {
    const asked = serve(catalog(150));

    const result = await getStoreProducts({ q: '', sort: 'newest', page: 999999 });

    expect(asked).toEqual([
      { offset: 0, limit: 96 },
      { offset: 96, limit: 96 },
    ]);
    expect(result.items).toHaveLength(150);
    expect(result.totalItems).toBe(150);
  });

  test('stops after the block that ends the catalog, when that block is full (NFR3)', async () => {
    // 192 products: the second block holds 96, as asked, so only the total tells there is no third block.
    const asked = serve(catalog(192));

    const result = await getStoreProducts({ q: '', sort: 'newest', page: 999999 });

    expect(asked).toEqual([
      { offset: 0, limit: 96 },
      { offset: 96, limit: 96 },
    ]);
    expect(ids(result.items)).toEqual(ids(catalog(192)));
    expect(result).toMatchObject({ totalItems: 192, complete: true });
  });

  test('counts the products it read when it read the whole catalog but one came twice (NFR18)', async () => {
    // The first block was cached before a product was added: the 96th product of that block heads the second, read
    // after it. The api counts 192, yet the catalog as read holds 191 products, and offering a Load more for the one
    // left would never end.
    const second = [product(96), ...catalog(191).slice(96)];
    const asked: number[] = [];
    server.use(
      http.get(URL_, ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get('offset'));
        asked.push(offset);
        const items = offset === 0 ? catalog(96) : second;
        return HttpResponse.json({ items, totalItems: 192, offset, limit: 96 });
      }),
    );

    const result = await getStoreProducts({ q: '', sort: 'newest', page: 999999 });

    expect(asked).toEqual([0, 96]);
    expect(ids(result.items)).toEqual(ids(catalog(191)));
    expect(result).toMatchObject({ totalItems: 191, complete: true });
  });

  test('stops at a block shorter than asked, and counts what it read, when the catalog shrank since the total was counted', async () => {
    const asked = serve(catalog(100), 400);

    const result = await getStoreProducts({ q: '', sort: 'newest', page: 10 });

    expect(asked).toHaveLength(2);
    expect(result.items).toHaveLength(100);
    // No more products past the short block: a total of 400 would offer a Load more that never ends.
    expect(result.totalItems).toBe(100);
  });

  test('asks the api for the newest first, without a keyword, when there is no search', async () => {
    const asked: Record<string, string>[] = [];
    server.use(
      http.get(URL_, ({ request }) => {
        asked.push(Object.fromEntries(new URL(request.url).searchParams));
        return HttpResponse.json({ items: catalog(3), totalItems: 3, offset: 0, limit: 96 });
      }),
    );

    await getStoreProducts({ q: '', sort: 'newest', page: 1 });

    expect(asked).toEqual([{ sort: 'NEWEST', offset: '0', limit: '96' }]);
  });

  // Relevance keeps the words in the order typed; another order does not depend on it, so its words go in one order.
  test.each([
    ['relevance', 'RELEVANCE', 'ao thun 100'],
    ['price-asc', 'PRICE_ASC', '100 ao thun'],
    ['price-desc', 'PRICE_DESC', '100 ao thun'],
    ['newest', 'NEWEST', '100 ao thun'],
  ] as const)(
    'asks every block of a search sorted by %s with the folded keyword and %s (AC18, AC20, AC22)',
    async (sort, apiSort, terms) => {
      const asked: Record<string, string>[] = [];
      server.use(
        http.get(URL_, ({ request }) => {
          const params = new URL(request.url).searchParams;
          asked.push(Object.fromEntries(params));
          const offset = Number(params.get('offset'));
          return HttpResponse.json({
            items: catalog(150).slice(offset, offset + 96),
            totalItems: 150,
            offset,
            limit: 96,
          });
        }),
      );

      const result = await getStoreProducts({ q: 'áo thun & 100%', sort, page: 5 });

      expect(asked).toEqual([
        { q: terms, sort: apiSort, offset: '0', limit: '96' },
        { q: terms, sort: apiSort, offset: '96', limit: '96' },
      ]);
      expect(result.items).toHaveLength(120);
    },
  );

  // The arguments of the cached block are the cache key, and they are exactly what the api is asked: one request for
  // every variant means one cache entry, so a new variant of a keyword cannot make the api read the products again.
  test.each(['A', 'á', 'a!', ' Ả ', '(a) A'])(
    'asks the api the same block for %j as for the other variants of one search (cache key)',
    async (q) => {
      const asked: Record<string, string>[] = [];
      server.use(
        http.get(URL_, ({ request }) => {
          asked.push(Object.fromEntries(new URL(request.url).searchParams));
          return HttpResponse.json({ items: catalog(3), totalItems: 3, offset: 0, limit: 96 });
        }),
      );

      await getStoreProducts({ q, sort: 'relevance', page: 1 });

      expect(asked).toEqual([{ q: 'a', sort: 'RELEVANCE', offset: '0', limit: '96' }]);
    },
  );

  test.each(['price-asc', 'price-desc', 'newest'] as const)(
    'asks the api the same block for "ao thun" and "thun ao" sorted by %s (cache key)',
    async (sort) => {
      const asked: string[] = [];
      server.use(
        http.get(URL_, ({ request }) => {
          asked.push(new URL(request.url).searchParams.get('q') ?? '');
          return HttpResponse.json({ items: catalog(3), totalItems: 3, offset: 0, limit: 96 });
        }),
      );

      await getStoreProducts({ q: 'ao thun', sort, page: 1 });
      await getStoreProducts({ q: 'Thun áo', sort, page: 1 });

      expect(asked).toEqual(['ao thun', 'ao thun']);
    },
  );

  test('keeps the words in the order typed for relevance, which ranks the phrase as typed first', async () => {
    const asked: string[] = [];
    server.use(
      http.get(URL_, ({ request }) => {
        asked.push(new URL(request.url).searchParams.get('q') ?? '');
        return HttpResponse.json({ items: catalog(3), totalItems: 3, offset: 0, limit: 96 });
      }),
    );

    await getStoreProducts({ q: 'thun ao', sort: 'relevance', page: 1 });

    expect(asked).toEqual(['thun ao']);
  });

  test.each(['%', '!!!', '–'])(
    'returns no product without asking the api for %j, a keyword with no word (NFR10)',
    async (q) => {
      const asked = serve(catalog(30));

      await expect(getStoreProducts({ q, sort: 'relevance', page: 999999 })).resolves.toEqual({
        items: [],
        totalItems: 0,
        complete: true,
      });
      expect(asked).toEqual([]);
    },
  );

  test('returns no product and a total of 0 for an empty catalog', async () => {
    const asked = serve([]);

    await expect(getStoreProducts({ q: '', sort: 'newest', page: 1 })).resolves.toEqual({
      items: [],
      totalItems: 0,
      complete: true,
    });
    expect(asked).toHaveLength(1);
  });

  test('says a read is complete when it got every block it needed', async () => {
    serve(catalog(30));

    await expect(getStoreProducts({ q: '', sort: 'newest', page: 1 })).resolves.toMatchObject({
      complete: true,
    });
    expect(captureError).not.toHaveBeenCalled();
  });

  test('keeps the products of the blocks it read when a later block fails, as whole loads of 24, and reports it', async () => {
    const items = catalog(300);
    server.use(
      http.get(URL_, ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get('offset'));
        if (offset > 0) return new HttpResponse(null, { status: 503 });
        return HttpResponse.json({ items: items.slice(0, 96), totalItems: 300, offset, limit: 96 });
      }),
    );

    const result = await getStoreProducts({ q: '', sort: 'newest', page: 6 });

    expect(ids(result.items)).toEqual(ids(catalog(96)));
    expect(result).toMatchObject({ totalItems: 300, complete: false });
    expect(captureError).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'http', status: 503 }),
      { feature: 'product-list', offset: 96 },
    );
  });

  test('cuts the products it kept to whole loads of 24 when a product was read twice', async () => {
    const second = [product(96), ...catalog(200).slice(96, 191)];
    let reads = 0;
    server.use(
      http.get(URL_, ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get('offset'));
        reads += 1;
        if (offset === 0) {
          return HttpResponse.json({ items: catalog(96), totalItems: 300, offset, limit: 96 });
        }
        if (offset === 96) {
          return HttpResponse.json({ items: second, totalItems: 300, offset, limit: 96 });
        }
        return HttpResponse.error();
      }),
    );

    const result = await getStoreProducts({ q: '', sort: 'newest', page: 9 });

    // 96 + 95 new products read before the third block failed: 191, cut to 168, seven loads of 24.
    expect(reads).toBe(3);
    expect(ids(result.items)).toEqual(ids(catalog(168)));
    expect(result.complete).toBe(false);
  });

  test('throws when the api answers 500, never an empty list (NFR26)', async () => {
    server.use(http.get(URL_, () => new HttpResponse(null, { status: 500 })));

    await expect(getStoreProducts({ q: '', sort: 'newest', page: 1 })).rejects.toMatchObject({
      kind: 'http',
      status: 500,
    });
  });

  test('throws when the api cannot be reached, never an empty list (NFR26)', async () => {
    server.use(http.get(URL_, () => HttpResponse.error()));

    await expect(getStoreProducts({ q: '', sort: 'newest', page: 1 })).rejects.toMatchObject({
      kind: 'network',
    });
  });

  test('throws when the body is not a page of StoreProductSummary', async () => {
    server.use(
      http.get(URL_, () =>
        HttpResponse.json({ items: [{ ...product(1), price: '100001' }], totalItems: 1 }),
      ),
    );

    await expect(getStoreProducts({ q: '', sort: 'newest', page: 1 })).rejects.toMatchObject({
      kind: 'validation',
    });
  });
});

describe('getStoreProducts of a category (SHOP-81)', () => {
  const CATEGORY_URL = 'https://api.example.test/api/categories/ao/products';
  const ao = { kind: 'category', slug: 'ao' } as const;

  /** Serves `items` as `GET /api/categories/ao/products` does, and records each request. */
  function serveCategory(items: ReturnType<typeof product>[], totalItems = items.length) {
    const asked: { sort: string | null; offset: number; limit: number; q: string | null }[] = [];
    server.use(
      http.get(CATEGORY_URL, ({ request }) => {
        const params = new URL(request.url).searchParams;
        const offset = Number(params.get('offset'));
        const limit = Number(params.get('limit'));
        asked.push({ sort: params.get('sort'), offset, limit, q: params.get('q') });
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

  test('reads the first 24 products of the category in a block of 96, with the catalog cache profile', async () => {
    const asked = serveCategory(catalog(30));

    const result = await getStoreProducts({ q: '', sort: 'newest', page: 1 }, ao);

    expect(asked).toEqual([{ sort: 'NEWEST', offset: 0, limit: 96, q: null }]);
    expect(result).toEqual({ items: catalog(24), totalItems: 30, complete: true });
    expect(cacheLife).toHaveBeenCalledWith('catalog');
  });

  test.each([
    ['price-asc', 'PRICE_ASC'],
    ['price-desc', 'PRICE_DESC'],
  ] as const)('asks the api for the order %s as %s (AC13)', async (sort, apiSort) => {
    const asked = serveCategory(catalog(3));

    await getStoreProducts({ q: '', sort, page: 1 }, ao);

    expect(asked.map((request) => request.sort)).toEqual([apiSort]);
  });

  test('never sends a keyword, since a category page has no search (AC13)', async () => {
    const asked = serveCategory(catalog(3));

    await getStoreProducts({ q: 'áo thun', sort: 'newest', page: 1 }, ao);

    expect(asked.map((request) => request.q)).toEqual([null]);
  });

  test('reads page × 24 products, and stops at the number of products on sale of the category (NFR3)', async () => {
    const asked = serveCategory(catalog(30));

    const result = await getStoreProducts({ q: '', sort: 'newest', page: 999999 }, ao);

    expect(asked).toHaveLength(1);
    expect(result).toEqual({ items: catalog(30), totalItems: 30, complete: true });
  });

  test('reads the next block when the page asks for more than 96 products', async () => {
    const asked = serveCategory(catalog(150));

    const result = await getStoreProducts({ q: '', sort: 'newest', page: 5 }, ao);

    expect(asked.map((request) => request.offset)).toEqual([0, 96]);
    expect(result?.items).toHaveLength(120);
  });

  test('returns no product and a total of 0 for a category with no product on sale (AC15)', async () => {
    serveCategory([]);

    await expect(getStoreProducts({ q: '', sort: 'newest', page: 1 }, ao)).resolves.toEqual({
      items: [],
      totalItems: 0,
      complete: true,
    });
  });

  test('returns null when the api answers 404: the category was hidden or deleted since its name was read', async () => {
    server.use(
      http.get(CATEGORY_URL, () =>
        HttpResponse.json({ status: 404, code: 'CATEGORY_NOT_FOUND' }, { status: 404 }),
      ),
    );

    await expect(getStoreProducts({ q: '', sort: 'newest', page: 1 }, ao)).resolves.toBeNull();
  });

  test.each(['..', '/', '%E0', 'áo', ''])(
    'returns null for the slug %j without asking the api (NFR9)',
    async (slug) => {
      await expect(
        getStoreProducts({ q: '', sort: 'newest', page: 1 }, { kind: 'category', slug }),
      ).resolves.toBeNull();
    },
  );

  test('throws when the api answers 500, never an empty list (NFR20)', async () => {
    server.use(http.get(CATEGORY_URL, () => new HttpResponse(null, { status: 500 })));

    await expect(getStoreProducts({ q: '', sort: 'newest', page: 1 }, ao)).rejects.toMatchObject({
      kind: 'http',
      status: 500,
    });
  });

  test('keeps the products read when a later block fails, and reports it', async () => {
    const items = catalog(300);
    server.use(
      http.get(CATEGORY_URL, ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get('offset'));
        if (offset > 0) return new HttpResponse(null, { status: 404 });
        return HttpResponse.json({ items: items.slice(0, 96), totalItems: 300, offset, limit: 96 });
      }),
    );

    const result = await getStoreProducts({ q: '', sort: 'newest', page: 6 }, ao);

    expect(ids(result?.items ?? [])).toEqual(ids(catalog(96)));
    expect(result?.complete).toBe(false);
    expect(captureError).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'http', status: 404 }),
      { feature: 'category-products', offset: 96 },
    );
  });
});
