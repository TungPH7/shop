// @vitest-environment node
import { createTranslator } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import en from '../../../../messages/en.json';
import vi_ from '../../../../messages/vi.json';

import ProductsPage, { generateMetadata } from './page';

// The page is rendered by Next (E2E, e2e/products.spec.ts); here its shell and its metadata. getTranslations reads the
// real messages of the locale, as in layout.test.tsx. The results are the dynamic hole inside the <Suspense>, an async
// Server Component that react-dom/server cannot render: a stub stands in for it, so the test sees where it goes.
vi.mock('next-intl/server', () => ({
  getTranslations: (
    options: 'Products' | 'Seo' | { locale: string; namespace: 'Products' | 'Seo' },
  ) => {
    const { locale, namespace } =
      typeof options === 'string' ? { locale: currentLocale, namespace: options } : options;
    return Promise.resolve(
      createTranslator({ locale, messages: locale === 'vi' ? vi_ : en, namespace }),
    );
  },
  setRequestLocale: (locale: string) => {
    currentLocale = locale;
  },
}));
// next/navigation does not resolve in Vitest: the stub of getPathname is the one of alternates.test.ts, localePrefix
// 'always'.
vi.mock('~/i18n/navigation', () => ({
  getPathname: ({ locale, href }: { locale: string; href: string }) =>
    href === '/' ? `/${locale}` : `/${locale}${href}`,
}));
vi.mock('~/features/product/components/product-results', () => ({
  ProductResults: () => <p>results stub</p>,
}));

let currentLocale = 'en';

const renderPage = async (locale: string) =>
  renderToStaticMarkup(
    await ProductsPage({
      params: Promise.resolve({ locale }),
      searchParams: Promise.resolve({}),
    }),
  );

const jsonLdOf = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(
    ([, json]) => JSON.parse(json ?? '{}') as { '@type': string; itemListElement: unknown[] },
  );

test('shows the title S4.2 as the only heading, without the intro of the template', async () => {
  const html = await renderPage('vi');

  expect(html).toContain('<h1>Sản phẩm</h1>');
  expect(html.match(/<h\d/g)).toEqual(['<h1']);
  expect(html).not.toContain('<p>Duyệt');
});

test('puts the BreadcrumbList Trang chủ › Sản phẩm in the shell, with the URLs of the locale', async () => {
  const [breadcrumb, ...others] = jsonLdOf(await renderPage('vi'));

  expect(others).toEqual([]);
  expect(breadcrumb).toMatchObject({
    '@type': 'BreadcrumbList',
    itemListElement: [
      { position: 1, name: 'Trang chủ', item: 'https://site.example.test/vi' },
      { position: 2, name: 'Sản phẩm', item: 'https://site.example.test/vi/products' },
    ],
  });
});

test('renders the results inside the <Suspense> after the title', async () => {
  const html = await renderPage('en');

  expect(html).toMatch(/<h1>Products<\/h1><p>results stub<\/p><\/main>$/);
});

test('generateMetadata gives the translated title and the canonical of /products', async () => {
  const metadata = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) });

  expect(metadata.title).toBe(en.Products.metaTitle);
  expect(metadata.description).toBe(en.Products.metaDescription);
  expect(metadata.alternates?.canonical).toBe('/en/products');
});
