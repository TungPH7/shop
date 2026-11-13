import { describe, expect, test, vi } from 'vitest';

import { localizedAlternates, localizedPathnames, localizedUrl } from '~/lib/seo/alternates';

// next-intl `createNavigation` (react-client build) import `next/navigation` KHÔNG resolve được trong
// Vitest (lỗi resolution ESM) → mock `~/i18n/navigation` bằng stub getPathname TRUNG THỰC (localePrefix
// 'always' = `/{locale}{href}`). Unit test ở đây kiểm LOGIC GHÉP của TA (canonical/x-default/absolute);
// hành vi thật của next-intl verify bằng build+curl (hreflang trong HTML + sitemap.xml). Mẫu mock giống
// language-switcher.test (folder 09).
vi.mock('~/i18n/navigation', () => ({
  getPathname: ({ locale, href }: { locale: string; href: string }) =>
    href === '/' ? `/${locale}` : `/${locale}${href}`,
}));

describe('localizedPathnames', () => {
  test('maps every locale to a prefixed path', () => {
    expect(localizedPathnames('/products')).toEqual({ en: '/en/products', vi: '/vi/products' });
  });

  test('home href → bare locale prefix', () => {
    expect(localizedPathnames('/')).toEqual({ en: '/en', vi: '/vi' });
  });
});

describe('localizedAlternates', () => {
  test('canonical = current locale; languages include x-default = default locale', () => {
    expect(localizedAlternates('vi', '/products')).toEqual({
      canonical: '/vi/products',
      languages: { en: '/en/products', vi: '/vi/products', 'x-default': '/en/products' },
    });
  });

  test('invalid locale falls back to defaultLocale for canonical', () => {
    expect(localizedAlternates('xx', '/about')?.canonical).toBe('/en/about');
  });
});

describe('localizedUrl', () => {
  test('absolute URL with locale prefix (uses NEXT_PUBLIC_SITE_URL)', () => {
    expect(localizedUrl('en', '/products')).toBe('https://site.example.test/en/products');
  });
});
