import { describe, expect, test, vi } from 'vitest';

import { fireEvent, renderWithProviders, screen, within } from '~/testing/render';

// The router of next-intl needs the App Router of Next, which Vitest does not have: the test holds its push, and
// getPathname adds the locale as the routing of the app does (localePrefix 'always'). The navigation itself, and the
// server render it brings, are in e2e/products.spec.ts.
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('~/i18n/navigation', () => ({
  useRouter: () => router,
  getPathname: ({ href, locale }: { href: string; locale: string }) => `/${locale}${href}`,
}));

import { ProductFilters } from './product-filters';

describe('<ProductFilters />', () => {
  test('is a GET search form of S4 with a search field named "Tìm theo tên" (S4.3)', () => {
    renderWithProviders(<ProductFilters query={{ q: '', sort: 'newest', page: 1 }} />, {
      locale: 'vi',
    });

    const form = screen.getByRole('search');
    expect(form).toHaveAttribute('method', 'get');
    expect(form).toHaveAttribute('action', '/vi/products');
    const field = within(form).getByRole('searchbox', { name: 'Tìm theo tên' });
    expect(field).toHaveAttribute('name', 'q');
    expect(field).toHaveAttribute('placeholder', 'Tìm sản phẩm…');
    expect(field).toHaveAttribute('maxlength', '100');
    expect(field).toHaveAttribute('enterkeyhint', 'search');
    expect(field).toHaveValue('');
  });

  test('keeps the keyword of the URL in the search field (AC18)', () => {
    renderWithProviders(<ProductFilters query={{ q: 'Áo Thun', sort: 'relevance', page: 1 }} />, {
      locale: 'vi',
    });

    expect(screen.getByRole('searchbox', { name: 'Tìm theo tên' })).toHaveValue('Áo Thun');
  });

  test('searches from the first 24 products, sorted by relevance, on Enter (S4.3, AC18)', async () => {
    const { user } = renderWithProviders(
      <ProductFilters query={{ q: '', sort: 'newest', page: 3 }} />,
      { locale: 'vi' },
    );

    await user.type(screen.getByRole('searchbox'), '  ÁO   THUN {Enter}');

    expect(router.push).toHaveBeenCalledWith('/products?q=%C3%81O+THUN');
  });

  test('keeps a sort the visitor chose when searching, also without JavaScript', async () => {
    const { user } = renderWithProviders(
      <ProductFilters query={{ q: '', sort: 'price-asc', page: 2 }} />,
      { locale: 'vi' },
    );

    // The form sends the sort chosen as a hidden field, so a GET of the browser lands on the same URL.
    const form = screen.getByRole('search');
    expect(Object.fromEntries(new FormData(form as HTMLFormElement))).toEqual({
      q: '',
      sort: 'price-asc',
    });

    await user.type(screen.getByRole('searchbox'), 'ao');
    // Enter: a browser submits a form whose only text field is this one, hidden fields aside (HTML, implicit
    // submission); user-event counts the hidden field and would not, so the test submits it.
    fireEvent.submit(form);

    expect(router.push).toHaveBeenCalledWith('/products?q=ao&sort=price-asc');
  });

  test('sends no sort the visitor did not choose', () => {
    renderWithProviders(<ProductFilters query={{ q: 'ao', sort: 'relevance', page: 1 }} />, {
      locale: 'vi',
    });

    expect(Object.fromEntries(new FormData(screen.getByRole('search')))).toEqual({ q: 'ao' });
  });

  test('leaves the search for an empty keyword', async () => {
    const { user } = renderWithProviders(
      <ProductFilters query={{ q: 'ao', sort: 'relevance', page: 2 }} />,
      { locale: 'vi' },
    );

    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), '{Enter}');

    expect(router.push).toHaveBeenCalledWith('/products');
  });

  test('shows the keyword of a new URL, as after Clear search', () => {
    const { rerender } = renderWithProviders(
      <ProductFilters query={{ q: 'xyz', sort: 'relevance', page: 1 }} />,
      { locale: 'vi' },
    );

    rerender(<ProductFilters query={{ q: '', sort: 'newest', page: 1 }} />);

    expect(screen.getByRole('searchbox')).toHaveValue('');
  });

  test('offers Mới nhất, Giá thấp đến cao and Giá cao đến thấp, and no relevance, without a search (S4.4, AC20)', () => {
    renderWithProviders(<ProductFilters query={{ q: '', sort: 'newest', page: 1 }} />, {
      locale: 'vi',
    });

    const select = screen.getByRole('combobox', { name: 'Sắp xếp' });
    expect(select).toHaveValue('newest');
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Mới nhất', 'Giá thấp đến cao', 'Giá cao đến thấp']);
  });

  test('offers Liên quan nhất while searching, chosen by default (S4.4, AC18)', () => {
    renderWithProviders(<ProductFilters query={{ q: 'ao', sort: 'relevance', page: 1 }} />, {
      locale: 'vi',
    });

    const select = screen.getByRole('combobox', { name: 'Sắp xếp' });
    expect(select).toHaveValue('relevance');
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Mới nhất', 'Giá thấp đến cao', 'Giá cao đến thấp', 'Liên quan nhất']);
  });

  test('applies a sort at once, from the first 24 products of the same search, without scrolling (S4.4)', async () => {
    const { user } = renderWithProviders(
      <ProductFilters query={{ q: 'ao', sort: 'relevance', page: 2 }} />,
      { locale: 'vi' },
    );

    const select = screen.getByRole('combobox', { name: 'Sắp xếp' });
    await user.selectOptions(select, 'Giá thấp đến cao');

    expect(router.push).toHaveBeenCalledWith('/products?q=ao&sort=price-asc', { scroll: false });
  });

  test('is named in English on the English page', () => {
    renderWithProviders(<ProductFilters query={{ q: 'ao', sort: 'relevance', page: 1 }} />, {
      locale: 'en',
    });

    expect(screen.getByRole('search')).toHaveAttribute('action', '/en/products');
    const field = screen.getByRole('searchbox', { name: 'Search by name' });
    expect(field).toHaveAttribute('placeholder', 'Search products…');
    const select = screen.getByRole('combobox', { name: 'Sort by' });
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Newest', 'Price: low to high', 'Price: high to low', 'Most relevant']);
  });
});

describe('<ProductFilters /> of a category (S5.4 of SHOP-81)', () => {
  const ao = { kind: 'category', slug: 'ao' } as const;

  test('has no search, only the sort with its visible label (AC13)', () => {
    const { container } = renderWithProviders(
      <ProductFilters query={{ q: '', sort: 'newest', page: 1 }} source={ao} />,
      { locale: 'vi' },
    );

    expect(screen.queryByRole('search')).toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Sắp xếp' })).toHaveValue('newest');
    expect(container.querySelector('.product-filters')).toHaveClass('product-filters--sort-only');
  });

  test('offers Mới nhất, Giá thấp đến cao and Giá cao đến thấp, and no Liên quan nhất (AC13)', () => {
    renderWithProviders(
      <ProductFilters query={{ q: '', sort: 'price-desc', page: 1 }} source={ao} />,
      { locale: 'vi' },
    );

    const select = screen.getByRole('combobox', { name: 'Sắp xếp' });
    expect(select).toHaveValue('price-desc');
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Mới nhất', 'Giá thấp đến cao', 'Giá cao đến thấp']);
  });

  test('applies a sort at once on the page of the category, from its first 24 products (S5.4)', async () => {
    const { user } = renderWithProviders(
      <ProductFilters query={{ q: '', sort: 'newest', page: 2 }} source={ao} />,
      { locale: 'vi' },
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sắp xếp' }), 'Giá thấp đến cao');

    expect(router.push).toHaveBeenCalledWith('/categories/ao?sort=price-asc', { scroll: false });
  });

  test('goes back to the newest first with no parameter (S5.4)', async () => {
    const { user } = renderWithProviders(
      <ProductFilters query={{ q: '', sort: 'price-asc', page: 1 }} source={ao} />,
      { locale: 'en' },
    );

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'Newest');

    expect(router.push).toHaveBeenCalledWith('/categories/ao', { scroll: false });
  });
});
