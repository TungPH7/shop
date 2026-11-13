import { describe, expect, test, vi } from 'vitest';

import { buildPageMetadata } from '~/lib/seo/metadata';

// buildPageMetadata → localizedAlternates → getPathname (next-intl). Mock như alternates.test.ts
// (createNavigation không resolve `next/navigation` trong Vitest); kiểm logic ghép metadata của ta.
vi.mock('~/i18n/navigation', () => ({
  getPathname: ({ locale, href }: { locale: string; href: string }) =>
    href === '/' ? `/${locale}` : `/${locale}${href}`,
}));

describe('buildPageMetadata', () => {
  test('indexable page → title + description + alternates (canonical/hreflang), no robots', () => {
    const md = buildPageMetadata({
      locale: 'en',
      title: 'Products',
      description: 'desc',
      pathname: '/products',
    });
    expect(md.title).toBe('Products');
    expect(md.description).toBe('desc');
    expect(md.alternates).toEqual({
      canonical: '/en/products',
      languages: { en: '/en/products', vi: '/vi/products', 'x-default': '/en/products' },
    });
    expect(md.robots).toBeUndefined();
  });

  test('noindex page → robots noindex/nofollow, no alternates', () => {
    const md = buildPageMetadata({
      locale: 'en',
      title: 'Account',
      pathname: '/account',
      index: false,
    });
    expect(md.robots).toEqual({ index: false, follow: false });
    expect(md.alternates).toBeUndefined();
  });

  test('omits description when not provided (exactOptionalPropertyTypes)', () => {
    const md = buildPageMetadata({ locale: 'en', title: 'X', pathname: '/x', index: false });
    expect('description' in md).toBe(false);
  });
});
