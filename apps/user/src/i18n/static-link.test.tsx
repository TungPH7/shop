import type * as NextNavigation from 'next/navigation';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders, screen } from '~/testing/render';

// The Link of next-intl reads the path with usePathname of Next on every render. That hook suspends during the
// prerender of a route with a dynamic param unknown at build time, so the mock fails a test that calls it: StaticLink
// must not (SHOP-41). The navigation of next-intl does not load outside Next; getPathname gives what it gives with
// localePrefix 'always'.
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof NextNavigation>()),
  usePathname: () => {
    throw new Error('StaticLink must not read the path');
  },
}));
vi.mock('~/i18n/navigation', () => ({
  usePathname: () => {
    throw new Error('StaticLink must not read the path');
  },
  getPathname: ({ href, locale }: { href: string; locale: string }) =>
    `/${locale}${href === '/' ? '' : href}`,
}));

import { StaticLink } from './static-link';

describe('<StaticLink />', () => {
  it('links to the page in the current locale', () => {
    renderWithProviders(<StaticLink href="/products">Sản phẩm</StaticLink>, { locale: 'vi' });

    expect(screen.getByRole('link', { name: 'Sản phẩm' })).toHaveAttribute('href', '/vi/products');
  });

  it('links home to the bare locale', () => {
    renderWithProviders(<StaticLink href="/">Home</StaticLink>, { locale: 'en' });

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/en');
  });

  it('passes the other props to the anchor', () => {
    renderWithProviders(
      <StaticLink href="/about" className="pill__link" aria-current="page">
        About
      </StaticLink>,
      { locale: 'en' },
    );

    const link = screen.getByRole('link', { name: 'About' });
    expect(link).toHaveClass('pill__link');
    expect(link).toHaveAttribute('aria-current', 'page');
  });
});
