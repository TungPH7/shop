// @vitest-environment node
// The DAL reads env.API_URL, a server variable: node, as client.test.ts. MSW answers at the network boundary.
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';

import { server } from '~/testing/msw/server';

import { getStoreProduct } from './get-product';

// `'use cache'` is a directive Next compiles; outside Next it is a plain string. cacheLife only works inside Next, so the
// test checks the DAL picks the catalog profile (plan of SHOP-7, Architecture Decisions 8).
const { cacheLife } = vi.hoisted(() => ({ cacheLife: vi.fn() }));
vi.mock('next/cache', () => ({ cacheLife }));

const BASE = 'https://api.example.test';

const product = {
  id: '019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f',
  name: 'Áo thun cổ tròn',
  slug: 'ao-thun-co-tron',
  price: 200000,
  compareAtPrice: 250000,
  availability: 'IN_STOCK',
  description: 'Áo thun cotton 100%.\nCổ tròn, tay ngắn.',
  updatedAt: '2026-11-16T02:15:30.000Z',
};

const notFound = {
  type: 'https://docs.example.com/errors/PRODUCT_NOT_FOUND',
  title: 'Product not found',
  status: 404,
  detail: 'Product not found.',
  instance: '/api/products/khong-co',
  code: 'PRODUCT_NOT_FOUND',
};

describe('getStoreProduct', () => {
  test('returns the product of the slug, read with the catalog cache profile', async () => {
    server.use(http.get(`${BASE}/api/products/ao-thun-co-tron`, () => HttpResponse.json(product)));

    await expect(getStoreProduct('ao-thun-co-tron')).resolves.toEqual(product);
    expect(cacheLife).toHaveBeenCalledWith('catalog');
  });

  test('returns null when the api answers 404', async () => {
    server.use(
      http.get(`${BASE}/api/products/khong-co`, () =>
        HttpResponse.json(notFound, {
          status: 404,
          headers: { 'Content-Type': 'application/problem+json' },
        }),
      ),
    );

    await expect(getStoreProduct('khong-co')).resolves.toBeNull();
  });

  test.each(['..', 'a b', 'áo-thun', ''])(
    'returns null for the slug %j without asking the api',
    async (slug) => {
      // MSW fails the test on any request without a handler (onUnhandledRequest: 'error').
      await expect(getStoreProduct(slug)).resolves.toBeNull();
    },
  );

  test('throws when the api answers 500, never null (NFR26)', async () => {
    server.use(
      http.get(
        `${BASE}/api/products/ao-thun-co-tron`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    await expect(getStoreProduct('ao-thun-co-tron')).rejects.toMatchObject({
      kind: 'http',
      status: 500,
    });
  });

  test('throws when the api cannot be reached', async () => {
    server.use(http.get(`${BASE}/api/products/ao-thun-co-tron`, () => HttpResponse.error()));

    await expect(getStoreProduct('ao-thun-co-tron')).rejects.toMatchObject({ kind: 'network' });
  });

  test('throws when the api takes more than 5 s (NFR26)', async () => {
    // The timer of AbortSignal.timeout is not one fake timers reach: the 5 s signal comes already fired, as in
    // client.test.ts, and the api never answers.
    const timeout = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(
        AbortSignal.abort(new DOMException('The operation timed out.', 'TimeoutError')),
      );
    server.use(
      http.get(`${BASE}/api/products/ao-thun-co-tron`, async () => {
        await delay('infinite');
        return HttpResponse.json(product);
      }),
    );

    await expect(getStoreProduct('ao-thun-co-tron')).rejects.toMatchObject({ kind: 'timeout' });
    expect(timeout).toHaveBeenCalledWith(5000);
  });

  test('throws when the body is not a StoreProduct', async () => {
    server.use(
      http.get(`${BASE}/api/products/ao-thun-co-tron`, () =>
        HttpResponse.json({ ...product, price: '200000' }),
      ),
    );

    await expect(getStoreProduct('ao-thun-co-tron')).rejects.toMatchObject({ kind: 'validation' });
  });
});
