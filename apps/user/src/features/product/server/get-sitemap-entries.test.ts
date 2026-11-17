// @vitest-environment node
// The DAL reads env.API_URL, a server variable: node, as get-products.test.ts. MSW answers at the network boundary and
// fails the test on any request without a handler.
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';

import { server } from '~/testing/msw/server';

import { getSitemapEntries } from './get-sitemap-entries';

const { cacheLife } = vi.hoisted(() => ({ cacheLife: vi.fn() }));
vi.mock('next/cache', () => ({ cacheLife }));

const URL_ = 'https://api.example.test/api/sitemap/products';

/** The n-th product on sale, as `GET /api/sitemap/products` returns it. */
const entry = (n: number) => ({
  slug: `san-pham-${n}`,
  updatedAt: `2026-11-16T02:15:${String(n % 60).padStart(2, '0')}.000Z`,
});

const catalog = (size: number) => Array.from({ length: size }, (_, i) => entry(i + 1));

/** Serves `items` as `GET /api/sitemap/products?offset=&limit=` does, and records each offset and limit asked. */
function serve(items: ReturnType<typeof entry>[], totalItems = items.length) {
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

describe('getSitemapEntries', () => {
  test('reads the products on sale in one block of 1,000, with the catalog cache profile', async () => {
    const asked = serve(catalog(2));

    const entries = await getSitemapEntries();

    expect(asked).toEqual([{ offset: 0, limit: 1000 }]);
    expect(entries).toEqual(catalog(2));
    expect(cacheLife).toHaveBeenCalledWith('catalog');
  });

  test('reads every block of 1,000 up to the number of products on sale', async () => {
    const asked = serve(catalog(2500));

    const entries = await getSitemapEntries();

    expect(asked).toEqual([
      { offset: 0, limit: 1000 },
      { offset: 1000, limit: 1000 },
      { offset: 2000, limit: 1000 },
    ]);
    expect(entries).toEqual(catalog(2500));
  });

  test('stops at a full last block, with no request for an empty one', async () => {
    const asked = serve(catalog(2000));

    const entries = await getSitemapEntries();

    expect(asked).toEqual([
      { offset: 0, limit: 1000 },
      { offset: 1000, limit: 1000 },
    ]);
    expect(entries).toHaveLength(2000);
  });

  test('stops at a block shorter than asked, even when the total says more', async () => {
    // Products hidden since the total was counted: the total says a second block, the first block says there is none.
    // Only the length of the block stops the read here, not the total.
    const asked = serve(catalog(500), 1501);

    const entries = await getSitemapEntries();

    expect(asked).toEqual([{ offset: 0, limit: 1000 }]);
    expect(entries).toEqual(catalog(500));
  });

  test('is empty when no product is on sale', async () => {
    serve([]);

    await expect(getSitemapEntries()).resolves.toEqual([]);
  });

  test('keeps a product once when it moved into the next block between two reads', async () => {
    // A product added between the two reads, with a smaller id, pushes the 1,000th product to the head of the second.
    const first = catalog(1000);
    const second = [entry(1000), entry(1001)];
    server.use(
      http.get(URL_, ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get('offset'));
        const items = offset === 0 ? first : second;
        return HttpResponse.json({ items, totalItems: 1002, offset, limit: 1000 });
      }),
    );

    const entries = await getSitemapEntries();

    expect(entries.map((item) => item.slug)).toEqual(catalog(1001).map((item) => item.slug));
  });

  test('throws when the api answers 500, never a sitemap short of products (NFR26)', async () => {
    server.use(http.get(URL_, () => new HttpResponse(null, { status: 500 })));

    await expect(getSitemapEntries()).rejects.toMatchObject({ kind: 'http', status: 500 });
  });

  test('throws when a block after the first fails, rather than keep the products read before it (NFR26)', async () => {
    server.use(
      http.get(URL_, ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get('offset'));
        if (offset > 0) return new HttpResponse(null, { status: 503 });
        return HttpResponse.json({ items: catalog(1000), totalItems: 1200, offset, limit: 1000 });
      }),
    );

    await expect(getSitemapEntries()).rejects.toMatchObject({ kind: 'http', status: 503 });
  });

  test('throws when the api takes more than 5 s (NFR26)', async () => {
    // The 5 s signal comes already fired, as in client.test.ts, and the api never answers.
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(
      AbortSignal.abort(new DOMException('The operation timed out.', 'TimeoutError')),
    );
    server.use(
      http.get(URL_, async () => {
        await delay('infinite');
        return HttpResponse.json({ items: [], totalItems: 0, offset: 0, limit: 1000 });
      }),
    );

    await expect(getSitemapEntries()).rejects.toMatchObject({ kind: 'timeout' });
  });

  test('throws when the body is not a page of sitemap entries', async () => {
    server.use(
      http.get(URL_, () =>
        HttpResponse.json({ items: [{ slug: 'a' }], totalItems: 1, offset: 0, limit: 1000 }),
      ),
    );

    await expect(getSitemapEntries()).rejects.toMatchObject({ kind: 'validation' });
  });
});
