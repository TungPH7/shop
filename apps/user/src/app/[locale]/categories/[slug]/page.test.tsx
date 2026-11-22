// @vitest-environment node
import {
  Children,
  Fragment,
  isValidElement,
  Suspense,
  type ReactElement,
  type ReactNode,
} from 'react';

import { createTranslator } from 'next-intl';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { JsonLd } from '~/components/seo/json-ld';
import { Breadcrumb } from '~/components/ui/breadcrumb';
import type { StoreCategory } from '~/features/category/model/category';
import { ProductResults } from '~/features/product/components/product-results';
import type { StoreProductList } from '~/features/product/server/get-products';
import { ApiError } from '~/lib/http/api-error';

import en from '../../../../../messages/en.json';
import vi_ from '../../../../../messages/vi.json';

import CategoryPage, { generateMetadata } from './page';

// The page is rendered by Next (E2E, e2e/category-page.spec.ts and e2e/category-seo.spec.ts); here its shape and its
// metadata. The view inside the <Suspense> is an async Server Component: the test calls it as a function and reads the
// elements it returns. The DAL, notFound and the functions of next-intl are the seams of the page; getTranslations reads
// the real messages, so the title and the meta description are the words of the SEO section of the SPEC.
const { getStoreCategory, getStoreProducts, notFound, setRequestLocale } = vi.hoisted(() => ({
  getStoreCategory: vi.fn<(slug: string) => Promise<StoreCategory | null>>(),
  getStoreProducts: vi.fn<(...args: unknown[]) => Promise<StoreProductList | null>>(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  setRequestLocale: vi.fn(),
}));
vi.mock('~/features/category/server/get-categories', () => ({ getStoreCategory }));
vi.mock('~/features/product/server/get-products', () => ({ getStoreProducts }));
vi.mock('next/navigation', () => ({ notFound }));
vi.mock('next-intl/server', () => ({
  getTranslations: ({ locale, namespace }: { locale: string; namespace: 'Seo' | 'Category' }) =>
    Promise.resolve(createTranslator({ locale, messages: locale === 'vi' ? vi_ : en, namespace })),
  setRequestLocale,
}));
// next-intl's createNavigation imports `next/navigation`, which Vitest cannot resolve: a faithful getPathname stub, as in
// alternates.test.ts (localePrefix 'always').
vi.mock('~/i18n/navigation', () => ({
  Link: () => null,
  useRouter: () => ({}),
  getPathname: ({ locale, href }: { locale: string; href: string }) =>
    href === '/' ? `/${locale}` : `/${locale}${href}`,
}));

type Params = Promise<{ locale: string; slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const ao: StoreCategory = { name: 'Áo', slug: 'ao' };

const withProducts: StoreProductList = {
  items: [
    {
      id: '0193a2b5-0000-7000-8000-000000000001',
      name: 'Áo thun cổ tròn',
      slug: 'ao-thun-co-tron',
      price: 200000,
      compareAtPrice: null,
      availability: 'IN_STOCK',
    },
  ],
  totalItems: 1,
  complete: true,
};

const empty: StoreProductList = { items: [], totalItems: 0, complete: true };

const pageOf = (params: Params, searchParams: SearchParams = Promise.resolve({})) =>
  CategoryPage({ params, searchParams }) as ReactElement<{
    className: string;
    children: ReactNode;
  }>;

/** The only <Suspense> of the page, and the view inside it. */
function boundaryOf(page: ReactElement<{ children: ReactNode }>) {
  const [boundary] = Children.toArray(page.props.children);
  if (!isValidElement<{ fallback: ReactNode; children: ReactNode }>(boundary)) {
    throw new Error('no element');
  }
  const [view] = Children.toArray(boundary.props.children);
  if (!isValidElement<{ params: Params; searchParams: SearchParams }>(view)) {
    throw new Error('no view');
  }
  return { boundary, view };
}

/** Runs the async view inside the boundary, as React would, and gives the elements it returns. */
async function partsOf(params: Params, searchParams: SearchParams = Promise.resolve({})) {
  const { view } = boundaryOf(pageOf(params, searchParams));
  const render = view.type as (props: typeof view.props) => Promise<ReactElement>;
  const element = await render(view.props);
  if (element.type !== Fragment) throw new Error('not a fragment');
  const [ld, breadcrumb, heading, results] = Children.toArray(
    (element.props as { children: ReactNode }).children,
  );
  if (
    !isValidElement<{ data: unknown }>(ld) ||
    !isValidElement<{ items: unknown; label: string }>(breadcrumb) ||
    !isValidElement<{ children: ReactNode; className: string }>(heading) ||
    !isValidElement<{ searchParams: SearchParams; source: unknown }>(results)
  ) {
    throw new Error('no parts');
  }
  return { ld, breadcrumb, heading, results };
}

beforeEach(() => {
  getStoreCategory.mockResolvedValue(ao);
  getStoreProducts.mockResolvedValue(withProducts);
});

describe('the page', () => {
  test('is a <main> as wide as the frame, for a grid of up to 4 columns (S5.5)', () => {
    const page = pageOf(Promise.resolve({ locale: 'vi', slug: 'ao' }));

    expect(page.type).toBe('main');
    expect(page.props.className).toBe('products-page');
  });

  test('reads params and the category only inside a <Suspense>, so next build never calls the api (NFR6)', () => {
    const params = Promise.resolve({ locale: 'vi', slug: 'ao' });
    const searchParams = Promise.resolve({ sort: 'price-asc' });

    const { boundary, view } = boundaryOf(pageOf(params, searchParams));

    expect(boundary.type).toBe(Suspense);
    expect(isValidElement(boundary.props.fallback)).toBe(true);
    expect(view.props.params).toBe(params);
    expect(view.props.searchParams).toBe(searchParams);
    expect(getStoreCategory).not.toHaveBeenCalled();
  });

  test('shows the name of the category as the only title, as entered (S5.3, AC12)', async () => {
    const { heading } = await partsOf(Promise.resolve({ locale: 'en', slug: 'ao' }));

    expect(setRequestLocale).toHaveBeenCalledWith('en');
    expect(getStoreCategory).toHaveBeenCalledWith('ao');
    expect(heading.type).toBe('h1');
    expect(heading.props.children).toBe('Áo');
  });

  test('shows the breadcrumb Trang chủ › Áo named "Đường dẫn trang", the crumbs of its JSON-LD (S5.2, AC18)', async () => {
    const { ld, breadcrumb } = await partsOf(Promise.resolve({ locale: 'vi', slug: 'AO' }));

    const crumbs = [
      { name: 'Trang chủ', url: 'https://site.example.test/vi' },
      { name: 'Áo', url: 'https://site.example.test/vi/categories/ao' },
    ];
    expect(breadcrumb.type).toBe(Breadcrumb);
    expect(breadcrumb.props).toEqual({ items: crumbs, label: 'Đường dẫn trang' });
    expect(ld.type).toBe(JsonLd);
    expect(ld.props.data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: crumbs[0]?.url },
        { '@type': 'ListItem', position: 2, name: 'Áo', item: crumbs[1]?.url },
      ],
    });
  });

  test('names the first crumb "Home" on the English page, with the URLs of the English page (AC18)', async () => {
    const { breadcrumb } = await partsOf(Promise.resolve({ locale: 'en', slug: 'ao' }));

    expect(breadcrumb.props).toEqual({
      items: [
        { name: 'Home', url: 'https://site.example.test/en' },
        { name: 'Áo', url: 'https://site.example.test/en/categories/ao' },
      ],
      label: 'Breadcrumb',
    });
  });

  test('shows the products of the category at its stored slug, with the searchParams of the page (S5.4–S5.10)', async () => {
    const searchParams = Promise.resolve({ sort: 'price-asc', page: '2' });

    const { results } = await partsOf(Promise.resolve({ locale: 'vi', slug: 'AO' }), searchParams);

    expect(results.type).toBe(ProductResults);
    expect(results.props.source).toEqual({ kind: 'category', slug: 'ao' });
    expect(results.props.searchParams).toBe(searchParams);
  });

  test('calls notFound when the store has no visible category at the slug (AC16)', async () => {
    getStoreCategory.mockResolvedValue(null);

    await expect(partsOf(Promise.resolve({ locale: 'vi', slug: 'khong-co' }))).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
  });

  test('lets an error of the api through to the error boundary, never a 404 (NFR20)', async () => {
    getStoreCategory.mockRejectedValue(
      new ApiError({ kind: 'http', status: 500, message: 'boom' }),
    );

    await expect(partsOf(Promise.resolve({ locale: 'vi', slug: 'ao' }))).rejects.toMatchObject({
      status: 500,
    });
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe('generateMetadata (AC18)', () => {
  const metadataOf = (locale: string, slug: string) =>
    generateMetadata({ params: Promise.resolve({ locale, slug }) });

  test('titles the page with tier 1 of the SEO section, for the template of the root layout to add its suffix', async () => {
    getStoreCategory.mockResolvedValue({ name: 'Áo khoác', slug: 'ao-khoac' });

    const metadata = await metadataOf('vi', 'ao-khoac');

    expect(metadata.title).toBe('Áo khoác – Xem giá và tình trạng còn hàng');
  });

  test('titles the English page with the English tier', async () => {
    getStoreCategory.mockResolvedValue({ name: 'Jackets', slug: 'jackets' });

    const metadata = await metadataOf('en', 'jackets');

    expect(metadata.title).toBe('Jackets – See prices and stock status');
  });

  test('describes the page with both sentences of the SEO section, the name first', async () => {
    const metadata = await metadataOf('vi', 'ao');

    expect(metadata.description).toBe(
      'Áo: xem giá, tình trạng còn hàng và chi tiết từng sản phẩm đang bán tại cửa hàng. Sắp xếp theo giá hoặc mới nhất, rồi chọn ngay sản phẩm bạn cần.',
    );
  });

  test('gives the canonical at the stored slug in the locale of the path, and hreflang vi, en and x-default', async () => {
    const metadata = await metadataOf('en', 'AO');

    expect(metadata.alternates).toEqual({
      canonical: '/en/categories/ao',
      languages: {
        vi: '/vi/categories/ao',
        en: '/en/categories/ao',
        // The default locale of the app, as on every page (localizedAlternates).
        'x-default': '/en/categories/ao',
      },
    });
    expect(metadata.robots).toBeUndefined();
  });

  test('knows whether the category has products from the cache entry of its first 24 products, the newest first', async () => {
    await metadataOf('vi', 'AO');

    expect(getStoreProducts).toHaveBeenCalledWith(
      { q: '', sort: 'newest', page: 1 },
      { kind: 'category', slug: 'ao' },
    );
  });

  test('sets noindex, nofollow and no canonical nor hreflang for a category with no product on sale (AC15)', async () => {
    getStoreProducts.mockResolvedValue(empty);

    const metadata = await metadataOf('vi', 'phu-kien');

    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(metadata.alternates).toBeUndefined();
  });

  test('keeps a name holding markup as text, for the Metadata API to escape (NFR10)', async () => {
    const name = '</script><script>alert(1)</script>';
    getStoreCategory.mockResolvedValue({ name, slug: 'ao' });

    const metadata = await metadataOf('vi', 'ao');

    expect(metadata.title).toBe(name);
    expect(String(metadata.description).startsWith(`${name}:`)).toBe(true);
  });

  test('calls notFound when the store has no visible category at the slug (AC16)', async () => {
    getStoreCategory.mockResolvedValue(null);

    await expect(metadataOf('vi', 'khong-co')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(getStoreProducts).not.toHaveBeenCalled();
  });

  test('calls notFound when the category was hidden or deleted since its name was read', async () => {
    getStoreProducts.mockResolvedValue(null);

    await expect(metadataOf('vi', 'ao')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  test('lets an error of the api through, never a 404 (NFR20)', async () => {
    getStoreProducts.mockRejectedValue(new ApiError({ kind: 'timeout', message: 'slow' }));

    await expect(metadataOf('vi', 'ao')).rejects.toMatchObject({ kind: 'timeout' });
  });
});
