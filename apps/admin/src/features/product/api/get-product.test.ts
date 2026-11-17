import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { getProduct, isProductMissing } from '@/features/product/api/get-product';
import { type AdminProduct } from '@/features/product/model/product';
import { ApiError } from '@/lib/api/api-error';
import { server } from '@/testing/msw/server';

// GET /api/admin/products/{id} of the API Contract in docs/specs/SHOP-7/plan.md, which
// S2 loads in edit mode (US3).

const shirt: AdminProduct = {
  id: '019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f',
  name: 'Áo thun cổ tròn',
  slug: 'ao-thun-co-tron',
  description: 'Áo thun cotton 100%.\nCổ tròn, tay ngắn.',
  price: 200000,
  compareAtPrice: 250000,
  status: 'HIDDEN',
  availability: 'IN_STOCK',
  createdAt: '2026-11-16T02:10:00.000Z',
  updatedAt: '2026-11-16T02:15:30.000Z',
  version: 1,
};

function problem(status: number, code: string) {
  return HttpResponse.json({ status, code, title: 'Problem', detail: '…' }, { status });
}

describe('getProduct', () => {
  it('reads the product of the id, a hidden one too, with its version', async () => {
    const ids: string[] = [];
    server.use(
      http.get('*/admin/products/:id', ({ params }) => {
        ids.push(String(params['id']));
        return HttpResponse.json(shirt);
      }),
    );

    await expect(getProduct(shirt.id)).resolves.toEqual(shirt);
    expect(ids).toEqual([shirt.id]);
  });

  it('keeps the id in one path segment', async () => {
    let path = '';
    server.use(
      http.get('*/admin/products/*', ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json(shirt);
      }),
    );

    await getProduct('a/b?c');

    expect(path).toMatch(/\/admin\/products\/a%2Fb%3Fc$/);
  });

  it('rejects a body that is not an AdminProduct', async () => {
    server.use(http.get('*/admin/products/:id', () => HttpResponse.json({ id: shirt.id })));

    await expect(getProduct(shirt.id)).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('isProductMissing', () => {
  async function errorOf(response: () => Response): Promise<unknown> {
    server.use(http.get('*/admin/products/:id', response));
    return getProduct(shirt.id).catch((error: unknown) => error);
  }

  it('is true for a 404, a product never made or deleted (S2.3)', async () => {
    expect(isProductMissing(await errorOf(() => problem(404, 'PRODUCT_NOT_FOUND')))).toBe(true);
  });

  it('is true for a 400 of an id that is no UUID, which no product has (S2.3)', async () => {
    expect(isProductMissing(await errorOf(() => problem(400, 'INVALID_PARAMETER')))).toBe(true);
  });

  it('is false for a failure that Try again may fix', () => {
    expect(isProductMissing(new ApiError({ kind: 'network', message: 'offline' }))).toBe(false);
    expect(isProductMissing(new ApiError({ kind: 'http', status: 503, message: '…' }))).toBe(false);
    expect(isProductMissing(new Error('boom'))).toBe(false);
  });
});
