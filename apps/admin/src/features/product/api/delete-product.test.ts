import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { deleteProduct } from '@/features/product/api/delete-product';
import { server } from '@/testing/msw/server';

// DELETE /api/admin/products/{id} of the API Contract in docs/specs/SHOP-7/plan.md:
// 204, even when the product is already gone.

const id = '019a8f2e-5b7c-7d10-9e3f-000000000002';

describe('deleteProduct', () => {
  it('deletes the product of the id and resolves on 204', async () => {
    const deleted: string[] = [];
    server.use(
      http.delete('*/admin/products/:id', ({ params }) => {
        deleted.push(String(params['id']));
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(deleteProduct(id)).resolves.toBeUndefined();
    expect(deleted).toEqual([id]);
  });

  it('keeps the id in one path segment', async () => {
    let path = '';
    server.use(
      http.delete('*/admin/products/*', ({ request }) => {
        path = new URL(request.url).pathname;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await deleteProduct('a/b?c');

    expect(path).toMatch(/\/admin\/products\/a%2Fb%3Fc$/);
  });

  it('sends the DELETE once when the network fails, and rejects (NFR19)', async () => {
    let calls = 0;
    server.use(
      http.delete('*/admin/products/:id', () => {
        calls += 1;
        return HttpResponse.error();
      }),
    );

    await expect(deleteProduct(id)).rejects.toMatchObject({ kind: 'network' });
    expect(calls).toBe(1);
  });

  it('rejects on a 5xx, without a retry', async () => {
    let calls = 0;
    server.use(
      http.delete('*/admin/products/:id', () => {
        calls += 1;
        return new HttpResponse(null, { status: 503 });
      }),
    );

    await expect(deleteProduct(id)).rejects.toMatchObject({ kind: 'http', status: 503 });
    expect(calls).toBe(1);
  });
});
