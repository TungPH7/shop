import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { getProducts, PRODUCTS_PAGE_SIZE } from '@/features/product/api/get-products';
import { type AdminProductSummary } from '@/features/product/model/product';
import { isApiError } from '@/lib/api/api-error';
import { server } from '@/testing/msw/server';

function product(index: number): AdminProductSummary {
  return {
    id: `019a8f2e-5b7c-7d10-9e3f-${String(index).padStart(12, '0')}`,
    name: `Product ${index}`,
    slug: `product-${index}`,
    price: 100000 + index,
    status: 'ACTIVE',
    availability: 'IN_STOCK',
    createdAt: '2026-11-16T02:10:00.000Z',
    updatedAt: '2026-11-16T02:10:00.000Z',
  };
}

// Records the query of each request to the list, and answers like the API: the
// products of `total` from the requested offset.
function listApi(total: number) {
  const requests: URLSearchParams[] = [];
  server.use(
    http.get('*/admin/products', ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      const offset = Number(params.get('offset') ?? 0);
      const limit = Number(params.get('limit') ?? 20);
      const items = Array.from({ length: Math.max(0, Math.min(limit, total - offset)) }, (_, i) =>
        product(offset + i + 1),
      );
      return HttpResponse.json({ items, totalItems: total, offset, limit });
    }),
  );
  return requests;
}

describe('getProducts', () => {
  it('asks for the first 20 products of every status with no keyword', async () => {
    const requests = listApi(3);

    const page = await getProducts({ q: '', status: 'all', page: 1 });

    expect(page.items).toHaveLength(3);
    expect(Object.fromEntries(requests[0] ?? [])).toEqual({
      status: 'ALL',
      offset: '0',
      limit: String(PRODUCTS_PAGE_SIZE),
    });
  });

  it('sends the status of the URL in upper case, as the API takes it', async () => {
    const requests = listApi(1);

    await getProducts({ q: '', status: 'hidden', page: 1 });
    await getProducts({ q: '', status: 'active', page: 1 });

    expect(requests.map((params) => params.get('status'))).toEqual(['HIDDEN', 'ACTIVE']);
  });

  it('sends offset = (page − 1) × 20', async () => {
    const requests = listApi(25);

    const page = await getProducts({ q: '', status: 'all', page: 2 });

    expect(requests[0]?.get('offset')).toBe('20');
    expect(page.offset).toBe(20);
    expect(page.items).toHaveLength(5);
  });

  it('sends the offset of the last page whose offset fits an int of the API', async () => {
    const requests = listApi(0);

    await getProducts({ q: '', status: 'all', page: 107_374_183 });

    expect(requests[0]?.get('offset')).toBe('2147483640');
  });

  it('asks for page 1, as for a wrong page (S1.11), when the offset would not fit an int of the API', async () => {
    const requests = listApi(3);

    const page = await getProducts({ q: '', status: 'all', page: 107_374_184 });

    expect(requests.map((params) => params.get('offset'))).toEqual(['0']);
    expect(page.offset).toBe(0);
    expect(page.items).toHaveLength(3);
  });

  it('sends the keyword without its surrounding spaces', async () => {
    const requests = listApi(1);

    await getProducts({ q: '  AO THUN ', status: 'all', page: 1 });

    expect(requests[0]?.get('q')).toBe('AO THUN');
  });

  it('shows page 1 when the page of the URL is past the last page (S1.11)', async () => {
    const requests = listApi(25);

    const page = await getProducts({ q: '', status: 'all', page: 9 });

    expect(requests.map((params) => params.get('offset'))).toEqual(['160', '0']);
    expect(page.offset).toBe(0);
    expect(page.items).toHaveLength(20);
  });

  it('keeps an empty page 1 when nothing matches', async () => {
    const requests = listApi(0);

    const page = await getProducts({ q: 'xyz', status: 'all', page: 1 });

    expect(requests).toHaveLength(1);
    expect(page).toEqual({ items: [], totalItems: 0, offset: 0, limit: 20 });
  });

  it('throws an ApiError when the API refuses the request', async () => {
    server.use(
      http.get('*/admin/products', () =>
        HttpResponse.json({ status: 400, code: 'INVALID_PARAMETER' }, { status: 400 }),
      ),
    );

    const error: unknown = await getProducts({ q: '', status: 'all', page: 1 }).catch(
      (caught: unknown) => caught,
    );

    expect(isApiError(error) && error.code).toBe('INVALID_PARAMETER');
  });
});
