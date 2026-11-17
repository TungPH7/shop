import { describe, expect, test, vi } from 'vitest';

import { renderWithProviders, screen } from '~/testing/render';

// The navigation of next-intl does not load outside Next; getPathname gives what it gives with localePrefix 'always'.
vi.mock('~/i18n/navigation', () => ({
  getPathname: ({ href, locale }: { href: string; locale: string }) => `/${locale}${href}`,
}));

import { ProductNotFound } from './product-not-found';

describe('<ProductNotFound />', () => {
  test.each([
    ['vi', 'Không tìm thấy sản phẩm', 'Sản phẩm này không tồn tại hoặc không còn được bán.'],
    ['en', 'Product not found', "This product doesn't exist or is no longer available."],
  ] as const)(
    'says in %s that the product was not found, as the only h1',
    (locale, title, line) => {
      renderWithProviders(<ProductNotFound />, { locale });

      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
      expect(screen.getByText(line)).toBeInTheDocument();
    },
  );

  test.each([
    ['vi', 'Xem tất cả sản phẩm'],
    ['en', 'View all products'],
  ] as const)('links to the products page S4 with no parameter in %s', (locale, name) => {
    renderWithProviders(<ProductNotFound />, { locale });

    const link = screen.getByRole('link', { name });
    expect(link).toHaveAttribute('href', `/${locale}/products`);
    expect(link).toHaveClass('btn', 'btn--primary');
  });

  test('is the <main> of the page, the glass card inside it', () => {
    renderWithProviders(<ProductNotFound />, { locale: 'vi' });

    const main = screen.getByRole('main');
    expect(main).toHaveClass('product-not-found');
    expect(main.querySelector('.card')).toContainElement(screen.getByRole('heading', { level: 1 }));
  });
});
