// @vitest-environment node
import { Children, isValidElement, Suspense, type ReactElement, type ReactNode } from 'react';

import { beforeEach, expect, test, vi } from 'vitest';

import { ProductDetail, ProductDetailSkeleton } from '~/features/product/components/product-detail';
import type { StoreProduct } from '~/features/product/model/product';
import { ApiError } from '~/lib/http/api-error';

import ProductPage from './page';

// The page is rendered by Next (E2E, e2e/product-detail.spec.ts); here its shape. The product view inside the
// <Suspense> is an async Server Component: the test calls it as a function and reads the element it returns. The DAL,
// notFound and setRequestLocale are the seams of the page.
const { getStoreProduct, notFound, setRequestLocale } = vi.hoisted(() => ({
  getStoreProduct: vi.fn<(slug: string) => Promise<StoreProduct | null>>(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  setRequestLocale: vi.fn(),
}));
vi.mock('~/features/product/server/get-product', () => ({ getStoreProduct }));
vi.mock('next/navigation', () => ({ notFound }));
vi.mock('next-intl/server', () => ({ setRequestLocale }));
vi.mock('~/i18n/navigation', () => ({ Link: () => null }));

const shirt: StoreProduct = {
  id: '019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f',
  name: 'Áo thun cổ tròn',
  slug: 'ao-thun-co-tron',
  price: 200000,
  compareAtPrice: 250000,
  availability: 'IN_STOCK',
  description: 'Áo thun cotton 100%.\nCổ tròn, tay ngắn.',
  updatedAt: '2026-11-16T02:15:30.000Z',
};

type Params = Promise<{ locale: string; slug: string }>;

const pageOf = (params: Params) =>
  ProductPage({ params }) as ReactElement<{ className: string; children: ReactNode }>;

/** The only <Suspense> of the page, and the element inside it. */
function boundaryOf(page: ReactElement<{ children: ReactNode }>) {
  const [boundary] = Children.toArray(page.props.children);
  if (!isValidElement<{ fallback: ReactNode; children: ReactNode }>(boundary)) {
    throw new Error('no element');
  }
  const [view] = Children.toArray(boundary.props.children);
  if (!isValidElement<{ params: Params }>(view)) throw new Error('no view');
  return { boundary, view };
}

/** Runs the async view inside the boundary, as React would. */
async function renderView(params: Params) {
  const { view } = boundaryOf(pageOf(params));
  const render = view.type as (props: { params: Params }) => Promise<ReactElement>;
  return render(view.props);
}

beforeEach(() => {
  getStoreProduct.mockResolvedValue(shirt);
});

test('is a <main> wider than other pages, for the two columns of S5', () => {
  const page = pageOf(Promise.resolve({ locale: 'vi', slug: 'ao-thun-co-tron' }));

  expect(page.type).toBe('main');
  expect(page.props.className).toBe('product-page');
});

test('reads params and the product only inside a <Suspense>, with the skeleton as fallback', () => {
  const params = Promise.resolve({ locale: 'vi', slug: 'ao-thun-co-tron' });

  const { boundary, view } = boundaryOf(pageOf(params));

  expect(boundary.type).toBe(Suspense);
  expect(isValidElement(boundary.props.fallback) && boundary.props.fallback.type).toBe(
    ProductDetailSkeleton,
  );
  expect(view.props.params).toBe(params);
  expect(getStoreProduct).not.toHaveBeenCalled();
});

test('shows the product of the slug, in the locale of the path', async () => {
  const element = await renderView(Promise.resolve({ locale: 'en', slug: 'ao-thun-co-tron' }));

  expect(setRequestLocale).toHaveBeenCalledWith('en');
  expect(getStoreProduct).toHaveBeenCalledWith('ao-thun-co-tron');
  expect(element.type).toBe(ProductDetail);
  expect((element.props as { product: StoreProduct }).product).toBe(shirt);
});

test('calls notFound when the store has no product at the slug', async () => {
  getStoreProduct.mockResolvedValue(null);

  await expect(renderView(Promise.resolve({ locale: 'vi', slug: 'khong-co' }))).rejects.toThrow(
    'NEXT_NOT_FOUND',
  );
  expect(notFound).toHaveBeenCalled();
});

test('lets an error of the api through to the error boundary, never a 404 (NFR26)', async () => {
  getStoreProduct.mockRejectedValue(new ApiError({ kind: 'http', status: 500, message: 'boom' }));

  await expect(
    renderView(Promise.resolve({ locale: 'vi', slug: 'ao-thun-co-tron' })),
  ).rejects.toMatchObject({ status: 500 });
  expect(notFound).not.toHaveBeenCalled();
});
