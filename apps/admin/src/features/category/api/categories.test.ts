import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import {
  categoryFailureOf,
  createCategory,
  deleteCategory,
  getCategories,
  getCategory,
  isCategoryMissing,
  updateCategory,
} from '@/features/category/api/categories';
import { type AdminCategory, type AdminCategoryListItem } from '@/features/category/model/category';
import { ApiError, isApiError } from '@/lib/api/api-error';
import { server } from '@/testing/msw/server';

// The admin API of categories, /api/admin/categories, of the API Contract in
// docs/specs/SHOP-81/plan.md, and how the form shows its errors.

const id = '019a9c41-2b3d-7e10-8f2a-3c4d5e6f7a8b';

const shirts: AdminCategory = {
  id,
  name: 'Áo',
  slug: 'ao',
  status: 'VISIBLE',
  createdAt: '2026-11-22T02:10:00.000Z',
  updatedAt: '2026-11-22T02:15:30.000Z',
  version: 1,
};

const rows: AdminCategoryListItem[] = [
  { ...shirts, productCount: 3 },
  {
    ...shirts,
    id: '019a9c41-2b3d-7e10-8f2a-000000000002',
    name: 'Phụ kiện',
    slug: 'phu-kien',
    status: 'HIDDEN',
    productCount: 0,
  },
];

function problem(status: number, code: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json({ status, code, title: 'Problem', detail: '…', ...extra }, { status });
}

describe('getCategories', () => {
  it('AC1 reads every category in the order of the api, with its product count', async () => {
    server.use(http.get('*/admin/categories', () => HttpResponse.json({ items: rows })));

    await expect(getCategories()).resolves.toEqual(rows);
  });

  it('rejects a body that is not a list of categories', async () => {
    server.use(http.get('*/admin/categories', () => HttpResponse.json(rows)));

    await expect(getCategories()).rejects.toMatchObject({ kind: 'validation' });
  });
});

describe('getCategory', () => {
  it('reads the category of the id, keeping the id in one path segment', async () => {
    let path = '';
    server.use(
      http.get('*/admin/categories/*', ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json(shirts);
      }),
    );

    await expect(getCategory('a/b?c')).resolves.toEqual(shirts);
    expect(path).toMatch(/\/admin\/categories\/a%2Fb%3Fc$/);
  });
});

describe('createCategory', () => {
  it('posts the input once, and is saved whatever the body of the 201', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.post('*/admin/categories', async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ id }, { status: 201 });
      }),
    );
    const input = { name: 'Áo khoác nữ', slug: null, status: 'VISIBLE' } as const;

    await expect(createCategory(input)).resolves.toBeUndefined();
    expect(bodies).toEqual([input]);
  });

  it('posts once, never again after a server error (NFR12)', async () => {
    let calls = 0;
    server.use(
      http.post('*/admin/categories', () => {
        calls += 1;
        return problem(503, 'SERVICE_UNAVAILABLE');
      }),
    );

    const error = await createCategory({ name: 'Áo', slug: null, status: 'VISIBLE' }).catch(
      (caught: unknown) => caught,
    );

    expect(isApiError(error) && error.status).toBe(503);
    expect(calls).toBe(1);
  });
});

describe('updateCategory', () => {
  it('puts every field with the version it loaded', async () => {
    const bodies: unknown[] = [];
    server.use(
      http.put('*/admin/categories/:id', async ({ request, params }) => {
        expect(params['id']).toBe(id);
        bodies.push(await request.json());
        return HttpResponse.json({ ...shirts, version: 2 });
      }),
    );
    const input = { name: 'Áo nam', slug: 'ao', status: 'VISIBLE', version: 1 } as const;

    await expect(updateCategory({ id, input })).resolves.toBeUndefined();
    expect(bodies).toEqual([input]);
  });

  it('sends the PUT once when the network fails (NFR12)', async () => {
    let calls = 0;
    server.use(
      http.put('*/admin/categories/:id', () => {
        calls += 1;
        return HttpResponse.error();
      }),
    );

    await expect(
      updateCategory({ id, input: { name: 'Áo', slug: 'ao', status: 'VISIBLE', version: 1 } }),
    ).rejects.toMatchObject({ kind: 'network' });
    expect(calls).toBe(1);
  });
});

describe('deleteCategory', () => {
  it('deletes the category of the id and resolves on 204', async () => {
    const deleted: string[] = [];
    server.use(
      http.delete('*/admin/categories/:id', ({ params }) => {
        deleted.push(String(params['id']));
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(deleteCategory(id)).resolves.toBeUndefined();
    expect(deleted).toEqual([id]);
  });

  it('counts a 404 as deleted, as the category is gone (S3.7)', async () => {
    server.use(http.delete('*/admin/categories/:id', () => problem(404, 'CATEGORY_NOT_FOUND')));

    await expect(deleteCategory(id)).resolves.toBeUndefined();
  });

  it('rejects on a 5xx, sent once', async () => {
    let calls = 0;
    server.use(
      http.delete('*/admin/categories/:id', () => {
        calls += 1;
        return new HttpResponse(null, { status: 503 });
      }),
    );

    await expect(deleteCategory(id)).rejects.toMatchObject({ kind: 'http', status: 503 });
    expect(calls).toBe(1);
  });
});

describe('isCategoryMissing', () => {
  it('is true for a 404 and for a 400 of an id that is no UUID (S2.3)', () => {
    expect(isCategoryMissing(new ApiError({ kind: 'http', status: 404, message: '…' }))).toBe(true);
    expect(isCategoryMissing(new ApiError({ kind: 'http', status: 400, message: '…' }))).toBe(true);
  });

  it('is false for a failure that Try again may fix', () => {
    expect(isCategoryMissing(new ApiError({ kind: 'network', message: 'offline' }))).toBe(false);
    expect(isCategoryMissing(new ApiError({ kind: 'http', status: 503, message: '…' }))).toBe(
      false,
    );
    expect(isCategoryMissing(new Error('boom'))).toBe(false);
  });
});

describe('categoryFailureOf', () => {
  function httpError(status: number, code?: string, details?: unknown): ApiError {
    return new ApiError({ kind: 'http', status, code, details, message: '…' });
  }

  it('AC4 is a taken name for 409 CATEGORY_NAME_DUPLICATED', () => {
    expect(categoryFailureOf(httpError(409, 'CATEGORY_NAME_DUPLICATED'), null)).toEqual({
      kind: 'nameTaken',
    });
  });

  it('AC4 is a taken slug for 409 CATEGORY_SLUG_DUPLICATED of a slug the form sent', () => {
    expect(categoryFailureOf(httpError(409, 'CATEGORY_SLUG_DUPLICATED'), 'ao-thun')).toEqual({
      kind: 'slugTaken',
    });
  });

  it('is no free generated slug for 409 CATEGORY_SLUG_DUPLICATED of slug null', () => {
    expect(categoryFailureOf(httpError(409, 'CATEGORY_SLUG_DUPLICATED'), null)).toEqual({
      kind: 'slugNotGenerated',
    });
  });

  it('is a conflict for 409 OPTIMISTIC_LOCK_CONFLICT', () => {
    expect(categoryFailureOf(httpError(409, 'OPTIMISTIC_LOCK_CONFLICT'), 'ao')).toEqual({
      kind: 'conflict',
    });
  });

  it('is a missing category for a 404 (S2.3)', () => {
    expect(categoryFailureOf(httpError(404, 'CATEGORY_NOT_FOUND'), 'ao')).toEqual({
      kind: 'notFound',
    });
  });

  it('AC3 names the fields of a 400 in their order on the form', () => {
    const error = httpError(400, 'VALIDATION_FAILED', {
      errors: [
        { field: 'slug', message: 'wrong format' },
        { field: 'name', message: 'must not be blank' },
        { field: 'slug', message: 'too long' },
      ],
    });

    expect(categoryFailureOf(error, 'A B')).toEqual({ kind: 'fields', fields: ['name', 'slug'] });
  });

  it.each([
    [
      'a 400 that names only the status',
      httpError(400, 'VALIDATION_FAILED', { errors: [{ field: 'status' }] }),
    ],
    ['a 400 with no list of errors', httpError(400, 'MALFORMED_REQUEST')],
    ['a 5xx', httpError(500, 'INTERNAL_ERROR')],
    ['another 409', httpError(409, 'SOMETHING_ELSE')],
    ['a timeout', new ApiError({ kind: 'timeout', message: 'timed out' })],
    ['an error that is no ApiError', new Error('boom')],
  ])('is a general error for %s (S2.4)', (_name, error) => {
    expect(categoryFailureOf(error, 'ao')).toEqual({ kind: 'general' });
  });
});
