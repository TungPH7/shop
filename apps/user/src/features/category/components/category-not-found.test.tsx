import { describe, expect, test, vi } from 'vitest';

import { renderWithProviders, screen } from '~/testing/render';

// The navigation of next-intl does not load outside Next; getPathname gives what it gives with localePrefix 'always'.
vi.mock('~/i18n/navigation', () => ({
  getPathname: ({ href, locale }: { href: string; locale: string }) => `/${locale}${href}`,
}));

import { CategoryNotFound } from './category-not-found';

describe('<CategoryNotFound />', () => {
  test.each([
    ['vi', 'Không tìm thấy danh mục', 'Danh mục này không tồn tại hoặc không còn được hiển thị.'],
    ['en', 'Category not found', "This category doesn't exist or is no longer available."],
  ] as const)(
    'says in %s that the category was not found, as the only h1 (S6.2, S6.3, AC16)',
    (locale, title, line) => {
      renderWithProviders(<CategoryNotFound />, { locale });

      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
      expect(screen.getByText(line)).toBeInTheDocument();
    },
  );

  test.each([
    ['vi', 'Xem tất cả sản phẩm'],
    ['en', 'View all products'],
  ] as const)(
    'links to the products page S7 with no parameter in %s, as the primary button (S6.4)',
    (locale, name) => {
      renderWithProviders(<CategoryNotFound />, { locale });

      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', `/${locale}/products`);
      expect(link).toHaveClass('btn', 'btn--primary');
    },
  );

  test('is the <main> of the page, the glass card of S6 of SHOP-7 inside it, with no breadcrumb', () => {
    renderWithProviders(<CategoryNotFound />, { locale: 'vi' });

    const main = screen.getByRole('main');
    expect(main).toHaveClass('product-not-found');
    expect(main.querySelector('.card')).toContainElement(screen.getByRole('heading', { level: 1 }));
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});
