import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { updateProduct, updateProductErrorOf } from '@/features/product/api/update-product';
import { type AdminProduct } from '@/features/product/model/product';
import { ApiError } from '@/lib/api/api-error';
import { server } from '@/testing/msw/server';

// PUT /api/admin/products/{id} of the API Contract in docs/specs/SHOP-7/plan.md, which
// S2 sends in edit mode (US3), and how the form shows its errors.

const id = '019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f';

const input = {
  name: 'Áo thun cổ tròn basic',
  slug: 'ao-thun-co-tron',
  description: null,
  price: 200000,
  compareAtPrice: 250000,
  status: 'ACTIVE',
  availability: 'IN_STOCK',
  categoryId: null,
  version: 1,
} as const;

const saved: AdminProduct = {
  id,
  ...input,
  createdAt: '2026-11-16T02:10:00.000Z',
  updatedAt: '2026-11-17T02:10:00.000Z',
  version: 2,
};

function problem(status: number, code: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json({ status, code, title: 'Problem', detail: '…', ...extra }, { status });
}

async function errorOf(response: () => Response): Promise<unknown> {
  server.use(http.put('*/admin/products/:id', response));
  return updateProduct({ id, input }).catch((error: unknown) => error);
}

describe('updateProduct', () => {
  it('puts every field with the version it loaded, and returns the product with its new version', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.put('*/admin/products/:id', async ({ request, params }) => {
        expect(params['id']).toBe(id);
        bodies.push(await request.json());
        return HttpResponse.json(saved);
      }),
    );

    await expect(updateProduct({ id, input })).resolves.toEqual(saved);
    expect(bodies).toEqual([input]);
  });

  it('keeps the id in one path segment', async () => {
    let path = '';
    server.use(
      http.put('*/admin/products/*', ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json(saved);
      }),
    );

    await updateProduct({ id: 'a/b?c', input });

    expect(path).toMatch(/\/admin\/products\/a%2Fb%3Fc$/);
  });

  it('sends the PUT once when the network fails, and rejects (NFR19)', async () => {
    let calls = 0;
    server.use(
      http.put('*/admin/products/:id', () => {
        calls += 1;
        return HttpResponse.error();
      }),
    );

    await expect(updateProduct({ id, input })).rejects.toMatchObject({ kind: 'network' });
    expect(calls).toBe(1);
  });

  it('sends the PUT once on a 5xx (NFR19)', async () => {
    let calls = 0;
    server.use(
      http.put('*/admin/products/:id', () => {
        calls += 1;
        return new HttpResponse(null, { status: 503 });
      }),
    );

    await expect(updateProduct({ id, input })).rejects.toMatchObject({ status: 503 });
    expect(calls).toBe(1);
  });
});

describe('updateProductErrorOf', () => {
  it('AC13 is a conflict for 409 OPTIMISTIC_LOCK_CONFLICT', async () => {
    const error = await errorOf(() => problem(409, 'OPTIMISTIC_LOCK_CONFLICT'));

    expect(updateProductErrorOf(error)).toEqual({ kind: 'conflict' });
  });

  it('is a taken slug for 409 PRODUCT_SLUG_DUPLICATED (S2.7)', async () => {
    const error = await errorOf(() => problem(409, 'PRODUCT_SLUG_DUPLICATED'));

    expect(updateProductErrorOf(error)).toEqual({ kind: 'slugTaken' });
  });

  it('is a missing product for 404 PRODUCT_NOT_FOUND (S2.3)', async () => {
    const error = await errorOf(() => problem(404, 'PRODUCT_NOT_FOUND'));

    expect(updateProductErrorOf(error)).toEqual({ kind: 'notFound' });
  });

  it('names the fields of a 400 in their order on the form', async () => {
    const error = await errorOf(() =>
      problem(400, 'VALIDATION_FAILED', {
        errors: [
          { field: 'price', message: 'too big' },
          { field: 'slug', message: 'wrong format' },
        ],
      }),
    );

    expect(updateProductErrorOf(error)).toEqual({ kind: 'fields', fields: ['slug', 'price'] });
  });

  it('is a general error for a 400 that names no field of the form, a 5xx or the network', async () => {
    expect(
      updateProductErrorOf(
        await errorOf(() => problem(400, 'VALIDATION_FAILED', { errors: [{ field: 'version' }] })),
      ),
    ).toEqual({ kind: 'general' });
    expect(updateProductErrorOf(await errorOf(() => problem(500, 'INTERNAL_ERROR')))).toEqual({
      kind: 'general',
    });
    expect(updateProductErrorOf(new ApiError({ kind: 'timeout', message: 'timed out' }))).toEqual({
      kind: 'general',
    });
    expect(updateProductErrorOf(await errorOf(() => problem(409, 'SOMETHING_ELSE')))).toEqual({
      kind: 'general',
    });
  });
});
