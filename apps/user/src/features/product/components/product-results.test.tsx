import { type ComponentProps } from 'react';

import { createTranslator } from 'next-intl';
import { describe, expect, test, vi } from 'vitest';

import type { StoreProductSummary } from '~/features/product/model/product';
import type { StoreProductList } from '~/features/product/server/get-products';
import { renderWithProviders, screen, within } from '~/testing/render';

import en from '../../../../messages/en.json';
import vi_ from '../../../../messages/vi.json';

// ProductResults is an async Server Component: the test awaits it, then renders what it returns. getTranslations reads
// the real messages of the locale, as in page.test.tsx. The DAL is the seam to the api (get-products.test.ts tests it).
const { getStoreProducts, locale, router } = vi.hoisted(() => ({
  getStoreProducts: vi.fn(),
  locale: { current: 'vi' },
  router: { replace: vi.fn(), refresh: vi.fn() },
}));
vi.mock('~/features/product/server/get-products', () => ({ getStoreProducts }));
vi.mock('next-intl/server', () => ({
  getTranslations: (namespace: 'Products') =>
    Promise.resolve(
      createTranslator({
        locale: locale.current,
        messages: locale.current === 'vi' ? vi_ : en,
        namespace,
      }),
    ),
}));
vi.mock('~/i18n/navigation', () => ({
  Link: ({ href, ...props }: ComponentProps<'a'> & { href: string }) => (
    <a href={`/${locale.current}${href}`} {...props} />
  ),
  useRouter: () => router,
}));

import { ProductResults, ProductResultsSkeleton } from './product-results';

const product = (n: number): StoreProductSummary => ({
  id: `0193a2b5-0000-7000-8000-${n.toString(16).padStart(12, '0')}`,
  name: `Sản phẩm ${n}`,
  slug: `san-pham-${n}`,
  price: 100000,
  compareAtPrice: null,
  availability: 'IN_STOCK',
});

const list = (shown: number, totalItems: number, complete = true): StoreProductList => ({
  items: Array.from({ length: shown }, (_, i) => product(i + 1)),
  totalItems,
  complete,
});

async function renderResults(
  searchParams: Record<string, string | string[] | undefined>,
  lang: 'vi' | 'en' = 'vi',
) {
  locale.current = lang;
  const results = await ProductResults({ searchParams: Promise.resolve(searchParams) });
  return renderWithProviders(results, { locale: lang });
}

describe('<ProductResults />', () => {
  test('shows the products in a list named "Danh sách sản phẩm", one card link per item (S4.5)', async () => {
    getStoreProducts.mockResolvedValue(list(24, 30));

    await renderResults({});

    const grid = screen.getByRole('list', { name: 'Danh sách sản phẩm' });
    const items = within(grid).getAllByRole('listitem');
    expect(items).toHaveLength(24);
    expect(within(items[0]!).getByRole('link', { name: /^Sản phẩm 1\b/ })).toHaveAttribute(
      'href',
      '/vi/products/san-pham-1',
    );
    expect(screen.queryByRole('button', { name: /xóa/i })).toBeNull();
  });

  test.each([
    [{}, 1],
    [{ page: '3' }, 3],
    [{ page: 'abc' }, 1],
    [{ page: '0' }, 1],
  ])('reads the products of %j as page %i', async (searchParams, page) => {
    getStoreProducts.mockResolvedValue(list(24, 100));

    await renderResults(searchParams);

    expect(getStoreProducts).toHaveBeenCalledWith({ page });
  });

  test.each([
    ['vi', 'Đã xem 24 trên 30 sản phẩm'],
    ['en', 'Viewed 24 of 30 products'],
  ] as const)('shows the progress line S4.9 in %s', async (lang, progress) => {
    getStoreProducts.mockResolvedValue(list(24, 30));

    await renderResults({}, lang);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(progress);
    expect(status).toHaveAttribute('aria-live', 'polite');
  });

  test('groups the thousands of the progress line as the locale does', async () => {
    getStoreProducts.mockResolvedValue(list(24, 1200));

    await renderResults({}, 'vi');

    expect(screen.getByRole('status')).toHaveTextContent('Đã xem 24 trên 1.200 sản phẩm');
  });

  test('offers Load more for the next page while products are left (AC21)', async () => {
    getStoreProducts.mockResolvedValue(list(24, 30));

    const { user } = await renderResults({});
    await user.click(screen.getByRole('button', { name: 'Xem thêm' }));

    expect(router.replace).toHaveBeenCalledWith('/products?page=2', { scroll: false });
  });

  test('has no Load more once every product is shown, and still the progress line (AC21)', async () => {
    getStoreProducts.mockResolvedValue(list(30, 30));

    await renderResults({ page: '2' });

    expect(screen.getAllByRole('listitem')).toHaveLength(30);
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Đã xem 30 trên 30 sản phẩm');
  });

  test('shows the products it could read and the error of S4.10 when a later block failed', async () => {
    getStoreProducts.mockResolvedValue(list(96, 300, false));

    const { user } = await renderResults({ page: '6' });

    expect(screen.getAllByRole('listitem')).toHaveLength(96);
    expect(screen.getByRole('status')).toHaveTextContent('Đã xem 96 trên 300 sản phẩm');
    expect(screen.getByRole('alert')).toHaveTextContent('Không tải thêm được. Vui lòng thử lại.');
    await user.click(screen.getByRole('button', { name: 'Xem thêm' }));
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  test.each([
    ['vi', 'Chưa có sản phẩm nào.'],
    ['en', 'No products yet.'],
  ] as const)(
    'says there is no product yet in %s, with no list and no button',
    async (lang, empty) => {
      getStoreProducts.mockResolvedValue(list(0, 0));

      await renderResults({}, lang);

      expect(screen.getByRole('status')).toHaveTextContent(empty);
      expect(screen.queryByRole('list')).toBeNull();
      expect(screen.queryByRole('button')).toBeNull();
    },
  );

  test('throws the error of the api to the error boundary, never an empty list (NFR26)', async () => {
    const error = Object.assign(new Error('Request failed with status 503'), { kind: 'http' });
    getStoreProducts.mockRejectedValue(error);

    await expect(ProductResults({ searchParams: Promise.resolve({}) })).rejects.toBe(error);
  });
});

describe('<ProductResultsSkeleton />', () => {
  test('shows 8 skeleton cards in a busy list, with no words (S4.5, loading)', () => {
    renderWithProviders(<ProductResultsSkeleton />, { locale: 'vi' });

    const grid = screen.getByRole('list', { name: 'Danh sách sản phẩm' });
    expect(grid).toHaveAttribute('aria-busy', 'true');
    expect(within(grid).getAllByRole('listitem')).toHaveLength(8);
    expect(grid.textContent).toBe('');
  });
});
