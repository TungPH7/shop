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
  router: { push: vi.fn(), replace: vi.fn(), refresh: vi.fn() },
}));
vi.mock('~/features/product/server/get-products', () => ({ getStoreProducts }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));
vi.mock('next-intl/server', () => ({
  getTranslations: (namespace: 'Products' | 'Category') =>
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
  getPathname: ({ href, locale }: { href: string; locale: string }) => `/${locale}${href}`,
}));

import { ProductResults } from './product-results';

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
    [{}, { q: '', sort: 'newest', page: 1 }],
    [{ page: '3' }, { q: '', sort: 'newest', page: 3 }],
    [
      { page: 'abc', sort: 'cheapest' },
      { q: '', sort: 'newest', page: 1 },
    ],
    [
      { q: 'ao', page: '0' },
      { q: 'ao', sort: 'relevance', page: 1 },
    ],
    [
      { q: ' ao ', sort: 'price-asc', page: '2' },
      { q: 'ao', sort: 'price-asc', page: 2 },
    ],
    [{ sort: 'relevance' }, { q: '', sort: 'newest', page: 1 }],
  ])('reads the products of %j as %j (AC22)', async (searchParams, query) => {
    getStoreProducts.mockResolvedValue(list(24, 100));

    await renderResults(searchParams);

    expect(getStoreProducts).toHaveBeenCalledWith(query);
  });

  test('shows the search and the sort of the URL above the grid (S4.3, S4.4)', async () => {
    getStoreProducts.mockResolvedValue(list(24, 30));

    await renderResults({ q: 'ao', sort: 'price-asc' });

    const field = screen.getByRole('searchbox', { name: 'Tìm theo tên' });
    expect(field).toHaveValue('ao');
    expect(screen.getByRole('combobox', { name: 'Sắp xếp' })).toHaveValue('price-asc');
    expect(field.compareDocumentPosition(screen.getByRole('list'))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  test('keeps the search and the sort in the URL of Load more (AC22)', async () => {
    getStoreProducts.mockResolvedValue(list(24, 30));

    const { user } = await renderResults({ q: 'ao', sort: 'price-asc' });
    await user.click(screen.getByRole('button', { name: 'Xem thêm' }));

    expect(router.replace).toHaveBeenCalledWith('/products?q=ao&sort=price-asc&page=2', {
      scroll: false,
    });
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
      expect(screen.queryByRole('link')).toBeNull();
      expect(screen.queryByRole('list')).toBeNull();
      expect(screen.queryByRole('button')).toBeNull();
    },
  );

  test.each([
    ['vi', 'Không tìm thấy sản phẩm nào cho “xyz”', 'Xóa tìm kiếm'],
    ['en', 'No products found for “xyz”', 'Clear search'],
  ] as const)(
    'says no product matches the keyword in %s, with a link that clears the search (S4.7, S4.8, AC23)',
    async (lang, noResults, clear) => {
      getStoreProducts.mockResolvedValue(list(0, 0));

      await renderResults({ q: 'xyz' }, lang);

      expect(screen.getByRole('status')).toHaveTextContent(noResults);
      expect(screen.getByRole('link', { name: clear })).toHaveAttribute(
        'href',
        `/${lang}/products`,
      );
      expect(screen.getByRole('searchbox')).toHaveValue('xyz');
      expect(screen.queryByRole('list')).toBeNull();
      expect(screen.queryByRole('button')).toBeNull();
    },
  );

  test('shows the keyword as words in the message, never as markup', async () => {
    getStoreProducts.mockResolvedValue(list(0, 0));

    await renderResults({ q: '<b>áo</b>' });

    expect(screen.getByRole('status')).toHaveTextContent(
      'Không tìm thấy sản phẩm nào cho “<b>áo</b>”',
    );
    expect(screen.getByRole('status').querySelector('b')).toBeNull();
  });

  test('throws the error of the api to the error boundary, never an empty list (NFR26)', async () => {
    const error = Object.assign(new Error('Request failed with status 503'), { kind: 'http' });
    getStoreProducts.mockRejectedValue(error);

    await expect(ProductResults({ searchParams: Promise.resolve({}) })).rejects.toBe(error);
  });
});

describe('<ProductResults /> of a category (S5 of SHOP-81)', () => {
  const ao = { kind: 'category', slug: 'ao' } as const;

  async function renderCategory(
    searchParams: Record<string, string | string[] | undefined>,
    lang: 'vi' | 'en' = 'vi',
  ) {
    locale.current = lang;
    const results = await ProductResults({
      searchParams: Promise.resolve(searchParams),
      source: ao,
    });
    return renderWithProviders(results, { locale: lang });
  }

  test('reads the products of the category in the order of the URL, with no keyword (AC13)', async () => {
    getStoreProducts.mockResolvedValue(list(2, 2));

    await renderCategory({ q: 'ao', sort: 'price-asc', page: '1' });

    expect(getStoreProducts).toHaveBeenCalledWith({ q: '', sort: 'price-asc', page: 1 }, ao);
  });

  test('reads a wrong order of the URL, or relevance, as the newest first (AC13, AC14)', async () => {
    getStoreProducts.mockResolvedValue(list(2, 2));

    await renderCategory({ sort: 'relevance', page: 'x' });

    expect(getStoreProducts).toHaveBeenCalledWith({ q: '', sort: 'newest', page: 1 }, ao);
  });

  test('shows the cards, the sort with no search, the progress line and Load more of the category (AC14)', async () => {
    getStoreProducts.mockResolvedValue(list(24, 30));

    const { user } = await renderCategory({ sort: 'price-asc' });

    expect(
      within(screen.getByRole('list', { name: 'Danh sách sản phẩm' })).getAllByRole('listitem'),
    ).toHaveLength(24);
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Sắp xếp' })).toHaveValue('price-asc');
    expect(screen.getByText('Đã xem 24 trên 30 sản phẩm')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Xem thêm' }));
    expect(router.replace).toHaveBeenCalledWith('/categories/ao?sort=price-asc&page=2', {
      scroll: false,
    });
  });

  test('says the category has no product yet, links to every product and shows no sort (AC15, S5.9, S5.10)', async () => {
    getStoreProducts.mockResolvedValue(list(0, 0));

    await renderCategory({});

    expect(screen.getByRole('status')).toHaveTextContent(
      'Chưa có sản phẩm nào trong danh mục này.',
    );
    expect(screen.getByRole('link', { name: 'Xem tất cả sản phẩm' })).toHaveAttribute(
      'href',
      '/vi/products',
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('list')).toBeNull();
  });

  test('says it in English on the English page (AC15)', async () => {
    getStoreProducts.mockResolvedValue(list(0, 0));

    await renderCategory({}, 'en');

    expect(screen.getByRole('status')).toHaveTextContent('No products in this category yet.');
    expect(screen.getByRole('link', { name: 'View all products' })).toHaveAttribute(
      'href',
      '/en/products',
    );
  });

  test('calls notFound when the category was hidden or deleted since the page read its name', async () => {
    getStoreProducts.mockResolvedValue(null);

    await expect(ProductResults({ searchParams: Promise.resolve({}), source: ao })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });

  test('throws the error of the api to the error boundary, never the empty state (NFR20)', async () => {
    const error = Object.assign(new Error('Request failed with status 503'), { kind: 'http' });
    getStoreProducts.mockRejectedValue(error);

    await expect(ProductResults({ searchParams: Promise.resolve({}), source: ao })).rejects.toBe(
      error,
    );
  });
});
