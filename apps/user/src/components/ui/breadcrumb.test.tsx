import { type ComponentProps } from 'react';

import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

// next-intl's createNavigation imports `next/navigation`, which Vitest cannot resolve. The stub stands for the Link of
// next-intl in the locale of the page, and keeps its other props; the E2E of AC20 checks the real one.
const { locale } = vi.hoisted(() => ({ locale: { current: 'vi' } }));
vi.mock('~/i18n/navigation', () => ({
  Link: ({ href, ...props }: ComponentProps<'a'> & { href: string }) => (
    <a
      data-link="next-intl"
      href={href === '/' ? `/${locale.current}` : `/${locale.current}${href}`}
      {...props}
    />
  ),
}));

import { Breadcrumb, BreadcrumbSkeleton } from './breadcrumb';

// The crumbs: absolute URLs in the locale of the page, as breadcrumbLd takes them (SPEC of SHOP-81, Code Style), and the
// paths without the locale, as the Link of next-intl takes them.
const threeCrumbs = [
  { name: 'Trang chủ', url: 'https://site.example.test/vi', href: '/' },
  { name: 'Áo', url: 'https://site.example.test/vi/categories/ao', href: '/categories/ao' },
  {
    name: 'Áo thun cổ tròn',
    url: 'https://site.example.test/vi/products/ao-thun-co-tron',
    href: '/products/ao-thun-co-tron',
  },
];

beforeEach(() => {
  locale.current = 'vi';
});

describe('<Breadcrumb />', () => {
  test('is a <nav> with its label, holding an <ol> of the crumbs in order (S5.2, S8.2)', () => {
    render(<Breadcrumb items={threeCrumbs} label="Đường dẫn trang" />);

    const nav = screen.getByRole('navigation', { name: 'Đường dẫn trang' });
    const items = within(within(nav).getByRole('list')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual(['Trang chủ›', 'Áo›', 'Áo thun cổ tròn']);
  });

  test('links every crumb but the last to its path in the locale of the page (AC20)', () => {
    render(<Breadcrumb items={threeCrumbs} label="Đường dẫn trang" />);

    expect(screen.getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('href', '/vi');
    expect(screen.getByRole('link', { name: 'Áo' })).toHaveAttribute('href', '/vi/categories/ao');
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });

  test('builds its links with the Link of next-intl, from the path without the locale (SPEC of SHOP-81, S5)', () => {
    render(<Breadcrumb items={threeCrumbs} label="Đường dẫn trang" />);

    for (const link of screen.getAllByRole('link')) {
      expect(link).toHaveAttribute('data-link', 'next-intl');
      expect(link).toHaveClass('breadcrumb__link');
    }
  });

  test('shows the last crumb as text, the current page', () => {
    render(<Breadcrumb items={threeCrumbs} label="Đường dẫn trang" />);

    const current = screen.getByText('Áo thun cổ tròn');
    expect(current.closest('a')).toBeNull();
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  test('hides the separators › from screen readers', () => {
    const { container } = render(<Breadcrumb items={threeCrumbs} label="Breadcrumb" />);

    const separators = container.querySelectorAll('.breadcrumb__separator');
    expect(separators).toHaveLength(2);
    for (const separator of separators) {
      expect(separator).toHaveAttribute('aria-hidden', 'true');
      expect(separator.textContent).toBe('›');
    }
  });

  test('has two crumbs for a product with no category, or a category page (AC18, AC21)', () => {
    locale.current = 'en';
    render(
      <Breadcrumb
        items={[
          { name: 'Home', url: 'https://site.example.test/en', href: '/' },
          { name: 'Áo', url: 'https://site.example.test/en/categories/ao', href: '/categories/ao' },
        ]}
        label="Breadcrumb"
      />,
    );

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/en');
    expect(screen.getByText('Áo')).toHaveAttribute('aria-current', 'page');
  });

  test('shows a name holding markup as text (NFR10)', () => {
    const name = '</script><script>alert(1)</script>';
    const { container } = render(
      <Breadcrumb
        items={[
          { name: 'Trang chủ', url: 'https://site.example.test/vi', href: '/' },
          { name, url: 'https://site.example.test/vi/categories/ao', href: '/categories/ao' },
        ]}
        label="Đường dẫn trang"
      />,
    );

    expect(screen.getByText(name)).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
  });
});

describe('<BreadcrumbSkeleton />', () => {
  test('holds the place of the breadcrumb, hidden from screen readers', () => {
    const { container } = render(<BreadcrumbSkeleton />);

    const skeleton = container.firstElementChild;
    expect(skeleton).toHaveClass('skeleton', 'breadcrumb-skeleton');
    expect(skeleton).toHaveAttribute('aria-hidden', 'true');
  });
});
