import { type ComponentProps } from 'react';

import { render, screen, within } from '@testing-library/react';
import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { StoreCategory } from '~/features/category/model/category';
import { ApiError } from '~/lib/http/api-error';

import en from '../../../../messages/en.json';
import vi_ from '../../../../messages/vi.json';

// CategoryLinks is an async Server Component: the test awaits it, then renders what it returns. The DAL is the seam to
// the api (get-categories.test.ts tests it); getTranslations reads the real messages of the locale.
const { connection, getStoreCategories, captureError, locale } = vi.hoisted(() => ({
  connection: vi.fn(() => Promise.resolve()),
  getStoreCategories: vi.fn<() => Promise<StoreCategory[]>>(),
  captureError: vi.fn(),
  locale: { current: 'vi' },
}));
// connection() is what keeps the row out of the prerender, so `next build` never calls the api (NFR6).
vi.mock('next/server', () => ({ connection }));
vi.mock('~/features/category/server/get-categories', () => ({ getStoreCategories }));
vi.mock('~/lib/monitoring/capture-error', () => ({ captureError }));
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
}));

import { CategoryLinks } from './category-links';

async function renderLinks(lang: 'vi' | 'en' = 'vi') {
  locale.current = lang;
  const element = await CategoryLinks();
  return render(<>{element}</>);
}

beforeEach(() => {
  getStoreCategories.mockResolvedValue([
    { name: 'Áo khoác', slug: 'ao-khoac' },
    { name: 'Bao tay', slug: 'bao-tay' },
  ]);
});

describe('<CategoryLinks />', () => {
  test('waits for a request before it reads the categories, so the build never calls the api (NFR6)', async () => {
    const order: string[] = [];
    connection.mockImplementation(() => {
      order.push('connection');
      return Promise.resolve();
    });
    getStoreCategories.mockImplementation(() => {
      order.push('categories');
      return Promise.resolve([]);
    });

    await renderLinks();

    expect(order).toEqual(['connection', 'categories']);
  });

  test('is a <nav> named "Danh mục" with its visible label and a list of links, in the order of the api (S7.3, AC17)', async () => {
    await renderLinks();

    const nav = screen.getByRole('navigation', { name: 'Danh mục' });
    expect(nav).toHaveTextContent(/^Danh mục/);
    const links = within(within(nav).getByRole('list')).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Áo khoác', 'Bao tay']);
  });

  test('links each category to its page in the locale of the page, with no parameter (S7.4, AC17)', async () => {
    await renderLinks('en');

    expect(screen.getByRole('navigation', { name: 'Categories' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Áo khoác' })).toHaveAttribute(
      'href',
      '/en/categories/ao-khoac',
    );
    expect(screen.getByRole('link', { name: 'Bao tay' })).toHaveAttribute(
      'href',
      '/en/categories/bao-tay',
    );
  });

  test('makes each link a small secondary button, with no count of products (S7.4)', async () => {
    await renderLinks();

    const link = screen.getByRole('link', { name: 'Áo khoác' });
    expect(link).toHaveClass('btn', 'btn--secondary', 'btn--sm');
    expect(link.textContent).toBe('Áo khoác');
  });

  test('shows a name holding markup as text (NFR10)', async () => {
    const name = '</script><script>alert(1)</script>';
    getStoreCategories.mockResolvedValue([{ name, slug: 'ao' }]);

    const { container } = await renderLinks();

    expect(screen.getByRole('link', { name })).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
  });

  test('shows nothing when no category has a product on sale (S7.3)', async () => {
    getStoreCategories.mockResolvedValue([]);

    const { container } = await renderLinks();

    expect(container).toBeEmptyDOMElement();
  });

  test('shows nothing, and reports the error, when the api fails: the products page still shows (NFR20)', async () => {
    const error = new ApiError({ kind: 'http', status: 500, message: 'boom' });
    getStoreCategories.mockRejectedValue(error);

    const { container } = await renderLinks();

    expect(container).toBeEmptyDOMElement();
    expect(captureError).toHaveBeenCalledWith(error, { feature: 'category-links' });
  });

  test('shows nothing when the api of v0.3.0 has no categories, after a rollback (NFR19)', async () => {
    getStoreCategories.mockRejectedValue(
      new ApiError({ kind: 'http', status: 404, message: 'gone' }),
    );

    const { container } = await renderLinks();

    expect(container).toBeEmptyDOMElement();
  });
});
