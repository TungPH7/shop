import { type ReactNode } from 'react';

import { QueryClientProvider, type QueryKey, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { useCreateProduct } from '@/features/product/api/create-product';
import { useDeleteProduct } from '@/features/product/api/delete-product';
import { useUpdateProduct } from '@/features/product/api/update-product';
import { type AdminProduct } from '@/features/product/model/product';
import { server } from '@/testing/msw/server';
import { createTestQueryClient } from '@/testing/render';

// Each write of a product changes the product counts of the categories (AC9 of SHOP-81):
// the list of products and every query of the categories load anew, so the Categories
// page and the delete dialog of a category never show a count of before.

const id = '019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f';

const product: AdminProduct = {
  id,
  name: 'Áo thun trắng',
  slug: 'ao-thun-trang',
  description: null,
  price: 150000,
  compareAtPrice: null,
  status: 'ACTIVE',
  availability: 'IN_STOCK',
  categoryId: '019a8f2e-5b7c-7d10-9e3f-0000000000a1',
  createdAt: '2026-11-16T02:10:00.000Z',
  updatedAt: '2026-11-16T02:10:00.000Z',
  version: 1,
};

// Keys of the category feature, written out: the product feature never imports it.
const categoryList: QueryKey = ['categories', 'list'];
const categoryDetail: QueryKey = ['categories', 'detail', product.categoryId];
const categoryOptions: QueryKey = ['categories', 'options'];
const productList: QueryKey = ['products', 'list', { q: '', status: 'all', page: 1 }];
const productDetail: QueryKey = ['products', 'detail', id];

function setUp() {
  const queryClient = createTestQueryClient();
  for (const key of [categoryList, categoryDetail, categoryOptions, productList, productDetail]) {
    queryClient.setQueryData(key, { seeded: true });
  }
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }
  const isInvalidated = (key: QueryKey) => queryClient.getQueryState(key)?.isInvalidated;
  return { queryClient, Wrapper, isInvalidated };
}

describe('the writes of a product', () => {
  it('AC9 an add refreshes the list of products and every query of the categories', async () => {
    server.use(
      http.post('*/admin/products', () =>
        HttpResponse.json(product, {
          status: 201,
          headers: { Location: `/api/admin/products/${id}` },
        }),
      ),
    );
    const { Wrapper, isInvalidated } = setUp();
    const { result } = renderHook(() => useCreateProduct(), { wrapper: Wrapper });

    await act(() =>
      result.current.mutateAsync({
        name: product.name,
        slug: null,
        description: null,
        price: product.price,
        compareAtPrice: null,
        status: 'ACTIVE',
        availability: 'IN_STOCK',
        categoryId: product.categoryId,
      }),
    );

    expect(isInvalidated(productList)).toBe(true);
    expect(isInvalidated(categoryList)).toBe(true);
    expect(isInvalidated(categoryDetail)).toBe(true);
    expect(isInvalidated(categoryOptions)).toBe(true);
  });

  it('AC9 an edit refreshes the list of products and every query of the categories', async () => {
    server.use(http.put('*/admin/products/:id', () => HttpResponse.json(product)));
    const { Wrapper, isInvalidated } = setUp();
    const { result } = renderHook(() => useUpdateProduct(), { wrapper: Wrapper });

    await act(() =>
      result.current.mutateAsync({
        id,
        input: {
          name: product.name,
          slug: product.slug,
          description: null,
          price: product.price,
          compareAtPrice: null,
          status: 'ACTIVE',
          availability: 'IN_STOCK',
          categoryId: null,
          version: 0,
        },
      }),
    );

    expect(isInvalidated(productList)).toBe(true);
    expect(isInvalidated(categoryList)).toBe(true);
    expect(isInvalidated(categoryDetail)).toBe(true);
    expect(isInvalidated(categoryOptions)).toBe(true);
  });

  it('a delete refreshes the list of products and every query of the categories', async () => {
    server.use(http.delete('*/admin/products/:id', () => new HttpResponse(null, { status: 204 })));
    const { Wrapper, isInvalidated } = setUp();
    const { result } = renderHook(() => useDeleteProduct(), { wrapper: Wrapper });

    await act(() => result.current.mutateAsync(id));

    expect(isInvalidated(productList)).toBe(true);
    expect(isInvalidated(categoryList)).toBe(true);
    expect(isInvalidated(categoryDetail)).toBe(true);
    expect(isInvalidated(categoryOptions)).toBe(true);
  });

  it('settles without waiting for the categories in use to load anew', async () => {
    // The field Category of the form keeps ['categories', 'options'] in use: its new
    // GET may be slow or retried, yet the product is already saved, so the toast and
    // the move to the list do not wait for it.
    server.use(http.put('*/admin/products/:id', () => HttpResponse.json(product)));
    const { Wrapper, queryClient } = setUp();
    const loads = vi.fn<() => Promise<unknown>>();
    loads.mockResolvedValueOnce([]).mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(
      () => {
        useQuery({ queryKey: categoryOptions, queryFn: loads });
        return useUpdateProduct();
      },
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(loads).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(queryClient.getQueryState(categoryOptions)?.fetchStatus).toBe('idle'),
    );
    const settled = vi.fn();

    void result.current
      .mutateAsync({
        id,
        input: {
          name: product.name,
          slug: product.slug,
          description: null,
          price: product.price,
          compareAtPrice: null,
          status: 'ACTIVE',
          availability: 'IN_STOCK',
          categoryId: null,
          version: 0,
        },
      })
      .then(settled);

    await waitFor(() => expect(settled).toHaveBeenCalledOnce());
    expect(loads).toHaveBeenCalledTimes(2);
    expect(queryClient.getQueryState(categoryOptions)?.fetchStatus).toBe('fetching');
  });

  it('leaves the product of the form alone, which loads anew each time the form opens', async () => {
    server.use(http.delete('*/admin/products/:id', () => new HttpResponse(null, { status: 204 })));
    const { Wrapper, isInvalidated } = setUp();
    const { result } = renderHook(() => useDeleteProduct(), { wrapper: Wrapper });

    await act(() => result.current.mutateAsync(id));

    expect(isInvalidated(productDetail)).toBe(false);
  });

  it('refreshes nothing when the write fails', async () => {
    server.use(http.delete('*/admin/products/:id', () => new HttpResponse(null, { status: 503 })));
    const { Wrapper, isInvalidated } = setUp();
    const { result } = renderHook(() => useDeleteProduct(), { wrapper: Wrapper });

    await act(() => result.current.mutateAsync(id).catch(() => undefined));

    expect(isInvalidated(productList)).toBe(false);
    expect(isInvalidated(categoryList)).toBe(false);
  });
});
