import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { createProduct, createProductErrorOf } from '@/features/product/api/create-product';
import { type AdminProduct } from '@/features/product/model/product';
import { type CreateProductInput } from '@/features/product/model/product-form';
import { ApiError, isApiError } from '@/lib/api/api-error';
import { server } from '@/testing/msw/server';

// POST /api/admin/products of the API Contract in docs/specs/SHOP-7/plan.md.

const input: CreateProductInput = {
  name: 'Đầm maxi đỏ',
  slug: null,
  description: null,
  price: 450000,
  compareAtPrice: null,
  status: 'ACTIVE',
  availability: 'IN_STOCK',
};

const created: AdminProduct = {
  id: '019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f',
  name: 'Đầm maxi đỏ',
  slug: 'dam-maxi-do',
  description: null,
  price: 450000,
  compareAtPrice: null,
  status: 'ACTIVE',
  availability: 'IN_STOCK',
  createdAt: '2026-11-16T02:10:00.000Z',
  updatedAt: '2026-11-16T02:10:00.000Z',
  version: 0,
};

function problem(status: number, code: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json(
    { type: 'about:blank', title: 'Problem', status, detail: '…', code, ...extra },
    { status },
  );
}

// The error createProduct throws for an answer of the api.
async function errorOf(response: () => Response): Promise<unknown> {
  server.use(http.post('*/admin/products', response));
  return createProduct(input).catch((error: unknown) => error);
}

describe('createProduct', () => {
  it('posts the input and returns the product the api made', async () => {
    let body: unknown;
    server.use(
      http.post('*/admin/products', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(created, { status: 201 });
      }),
    );

    const product = await createProduct(input);

    expect(body).toEqual(input);
    expect(product).toEqual(created);
  });

  it('posts once, never again after a server error (NFR19)', async () => {
    let calls = 0;
    server.use(
      http.post('*/admin/products', () => {
        calls += 1;
        return problem(503, 'SERVICE_UNAVAILABLE');
      }),
    );

    const error = await createProduct(input).catch((caught: unknown) => caught);

    expect(isApiError(error) && error.status).toBe(503);
    expect(calls).toBe(1);
  });
});

describe('createProductErrorOf', () => {
  it('lists the known fields of a 400 VALIDATION_FAILED', async () => {
    const error = await errorOf(() =>
      problem(400, 'VALIDATION_FAILED', {
        errors: [
          { field: 'name', rejectedValue: '', message: 'must not be blank' },
          { field: 'compareAtPrice', rejectedValue: 1, message: 'must be greater than price' },
          { field: 'somethingElse', rejectedValue: 1, message: '…' },
        ],
      }),
    );

    expect(createProductErrorOf(error, input)).toEqual({
      kind: 'fields',
      fields: ['name', 'compareAtPrice'],
    });
  });

  it('is a general error for a 400 that names no field of the form', async () => {
    const error = await errorOf(() =>
      problem(400, 'VALIDATION_FAILED', {
        errors: [{ field: 'status', rejectedValue: 'GONE', message: '…' }],
      }),
    );

    expect(createProductErrorOf(error, input)).toEqual({ kind: 'general' });
  });

  it('is a taken slug for a 409 PRODUCT_SLUG_DUPLICATED of a typed slug (AC8)', async () => {
    const error = await errorOf(() => problem(409, 'PRODUCT_SLUG_DUPLICATED'));

    expect(createProductErrorOf(error, { ...input, slug: 'ao-thun-co-tron' })).toEqual({
      kind: 'slugTaken',
    });
  });

  it('is no free generated slug for a 409 PRODUCT_SLUG_DUPLICATED of slug null', async () => {
    const error = await errorOf(() => problem(409, 'PRODUCT_SLUG_DUPLICATED'));

    expect(createProductErrorOf(error, input)).toEqual({ kind: 'slugNotGenerated' });
  });

  it.each([
    ['a 5xx', () => problem(500, 'INTERNAL_ERROR')],
    ['a network error', () => HttpResponse.error()],
    ['another 409', () => problem(409, 'SOMETHING_ELSE')],
    ['a 2xx the schema rejects', () => HttpResponse.json({ id: 1 }, { status: 201 })],
  ])('is a general error for %s (S2.5)', async (_name, response) => {
    const error = await errorOf(response);

    expect(createProductErrorOf(error, input)).toEqual({ kind: 'general' });
  });

  it('is a general error for anything that is not an ApiError', () => {
    expect(createProductErrorOf(new Error('boom'), input)).toEqual({ kind: 'general' });
    expect(
      createProductErrorOf(new ApiError({ kind: 'timeout', message: 'timed out' }), input),
    ).toEqual({ kind: 'general' });
  });
});
