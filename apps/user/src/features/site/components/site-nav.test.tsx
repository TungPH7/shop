import { type ComponentProps } from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders, screen, within } from '~/testing/render';

// The Link and usePathname of next-intl need the App Router of Next: Link becomes a plain <a> with the locale prefix it
// would add, and the pathname is set per test. The switchers inside the bar keep their own unit tests.
const { pathname } = vi.hoisted(() => ({ pathname: { current: '/' } }));
vi.mock('~/i18n/navigation', () => ({
  Link: ({ href, ...props }: ComponentProps<'a'> & { href: string }) => (
    <a href={`/vi${href === '/' ? '' : href}`} {...props} />
  ),
  usePathname: () => pathname.current,
  getPathname: ({ href, locale }: { href: string; locale: string }) => `/${locale}${href}`,
}));
vi.mock('next-themes', () => ({ useTheme: () => ({ theme: 'system', setTheme: vi.fn() }) }));

import { SiteNav } from './site-nav';

const mainNav = () => screen.getByRole('navigation', { name: 'Điều hướng chính' });

describe('<SiteNav />', () => {
  beforeEach(() => {
    pathname.current = '/';
  });

  it('links to Home, Products and About in the main navigation', () => {
    renderWithProviders(<SiteNav account={null} />, { locale: 'vi' });

    const links = within(mainNav()).getAllByRole('link');
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Trang chủ', '/vi'],
      ['Sản phẩm', '/vi/products'],
      ['Giới thiệu', '/vi/about'],
    ]);
  });

  it('names the main navigation in English too', () => {
    renderWithProviders(<SiteNav account={null} />, { locale: 'en' });

    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('marks the section of the current page with aria-current=page, and only it', () => {
    pathname.current = '/products/ao-thun-co-tron';
    renderWithProviders(<SiteNav account={null} />, { locale: 'vi' });

    expect(within(mainNav()).getByRole('link', { name: 'Sản phẩm' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(mainNav()).getByRole('link', { name: 'Trang chủ' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(within(mainNav()).getByRole('link', { name: 'Giới thiệu' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('marks no section on a page outside the three', () => {
    pathname.current = '/login';
    renderWithProviders(<SiteNav account={null} />, { locale: 'vi' });

    expect(
      within(mainNav())
        .getAllByRole('link')
        .filter((link) => link.hasAttribute('aria-current')),
    ).toEqual([]);
  });

  it('puts the site name, as a link home, in the banner', () => {
    renderWithProviders(<SiteNav account={null} />, { locale: 'vi' });

    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('link', { name: 'tungph7 codebase' })).toHaveAttribute(
      'href',
      '/vi',
    );
  });

  it('holds the language and theme switches and the account slot', () => {
    renderWithProviders(<SiteNav account={<button type="button">Đăng nhập</button>} />, {
      locale: 'vi',
    });

    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('group', { name: 'Ngôn ngữ' })).toBeInTheDocument();
    expect(within(banner).getByRole('group', { name: 'Giao diện' })).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument();
  });
});
