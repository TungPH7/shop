import { use } from 'react';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders, screen, within } from '~/testing/render';

// The navigation of next-intl needs the App Router of Next: getPathname gives the href it gives with localePrefix
// 'always', and the pathname is set per test. `null` is a path not known yet: during the prerender of a route with a
// dynamic param that generateStaticParams does not list, usePathname suspends, as `use` of a pending promise does here.
// The switchers inside the bar keep their own unit tests.
const { pathname, unknownPath } = vi.hoisted(() => {
  const pathname: { current: string | null } = { current: '/' };
  return {
    pathname,
    unknownPath: new Promise<string>(() => {}),
  };
});
vi.mock('~/i18n/navigation', () => ({
  usePathname: () => pathname.current ?? use(unknownPath),
  getPathname: ({ href, locale }: { href: string; locale: string }) =>
    `/${locale}${href === '/' ? '' : href}`,
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

  // Next 16 with cacheComponents fails the build when the path is read outside a Suspense boundary on such a route
  // (SHOP-41, review of PR #24). Only the mark of the current section waits for the path; the rest of the bar is in the
  // static shell, with the same three links, so nothing moves when the mark comes.
  it('renders the whole bar, with no current section, while the path is not known', () => {
    pathname.current = null;
    renderWithProviders(<SiteNav account={<button type="button">Đăng nhập</button>} />, {
      locale: 'vi',
    });

    const banner = screen.getByRole('banner');
    expect(within(banner).getByRole('link', { name: 'tungph7 codebase' })).toBeInTheDocument();
    const links = within(mainNav()).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Trang chủ', 'Sản phẩm', 'Giới thiệu']);
    expect(links.filter((link) => link.hasAttribute('aria-current'))).toEqual([]);
    expect(within(banner).getByRole('group', { name: 'Ngôn ngữ' })).toBeInTheDocument();
    expect(within(banner).getByRole('group', { name: 'Giao diện' })).toBeInTheDocument();
    expect(within(banner).getByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument();
  });
});
