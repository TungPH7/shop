import { createTranslator } from 'next-intl';
import { expect, test, vi } from 'vitest';

import en from '../../../messages/en.json';
import vi_ from '../../../messages/vi.json';

import { generateMetadata, generateStaticParams } from './layout';

// The root layout is rendered by Next (E2E, e2e/design-system.spec.ts); its two plain exports are unit-tested here.
// next/font only runs in the build of Next, and getTranslations needs the request config of next-intl: the font is a
// stub, and getTranslations reads the real messages of the locale. The navigation of next-intl needs the runtime of
// Next too; the components of the layout use it, the two exports do not.
vi.mock('~/config/fonts', () => ({ sans: { variable: 'font-sans-stub' } }));
vi.mock('~/i18n/navigation', () => ({
  Link: () => null,
  usePathname: () => '/',
  useRouter: () => ({}),
  redirect: vi.fn(),
}));
vi.mock('next-intl/server', () => ({
  getTranslations: ({ locale, namespace }: { locale: string; namespace: 'Seo' }) =>
    Promise.resolve(createTranslator({ locale, messages: locale === 'vi' ? vi_ : en, namespace })),
  setRequestLocale: vi.fn(),
}));

const params = (locale: string) => Promise.resolve({ locale });

test('generateStaticParams prerenders every locale', () => {
  expect(generateStaticParams()).toEqual([{ locale: 'en' }, { locale: 'vi' }]);
});

test('generateMetadata gives the description and the og:locale of the locale', async () => {
  const metadata = await generateMetadata({ params: params('vi') });

  expect(metadata.description).toBe(vi_.Seo.siteDescription);
  expect(metadata.openGraph).toMatchObject({ locale: 'vi_VN', alternateLocale: ['en_US'] });
});

// The sentences the human chose for SHOP-73 (sentence A): they tell what the shop does, not the template it came from.
const SHOP_DESCRIPTION = {
  vi: 'Xem các sản phẩm đang bán, tìm theo tên, sắp xếp theo giá và xem chi tiết từng sản phẩm, có giá và tình trạng còn hàng.',
  en: "Browse the products on sale, search by name, sort by price, and see each product's details, price and stock.",
} as const;

for (const locale of ['vi', 'en'] as const) {
  test(`generateMetadata describes the shop by default in ${locale}, in fewer than 160 characters`, async () => {
    const metadata = await generateMetadata({ params: params(locale) });

    expect(metadata.description).toBe(SHOP_DESCRIPTION[locale]);
    expect(Array.from(SHOP_DESCRIPTION[locale]).length).toBeLessThan(160);
  });
}

test('the share image of each locale carries the tagline of the shop', () => {
  expect(vi_.Seo.ogImageTagline).toBe('Cửa hàng trực tuyến');
  expect(en.Seo.ogImageTagline).toBe('Online shop');
});

test('generateMetadata falls back to the og:locale of the default locale for an unknown locale', async () => {
  const metadata = await generateMetadata({ params: params('fr') });

  expect(metadata.openGraph).toMatchObject({ locale: 'en_US', alternateLocale: ['vi_VN'] });
});

test('generateMetadata puts the site name in the title template and the site origin in metadataBase', async () => {
  const metadata = await generateMetadata({ params: params('en') });

  expect(metadata.title).toEqual({
    default: 'tungph7 codebase',
    template: '%s · tungph7 codebase',
  });
  expect(String(metadata.metadataBase)).toBe('https://site.example.test/');
});
