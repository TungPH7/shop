// @vitest-environment node
import {
  Children,
  Fragment,
  isValidElement,
  Suspense,
  type ReactElement,
  type ReactNode,
} from 'react';

import { beforeEach, describe, expect, test, vi } from 'vitest';

import { JsonLd } from '~/components/seo/json-ld';
import { Breadcrumb } from '~/components/ui/breadcrumb';
import { ProductDetail, ProductDetailSkeleton } from '~/features/product/components/product-detail';
import type { StoreProduct } from '~/features/product/model/product';
import { ApiError } from '~/lib/http/api-error';

import ProductPage, { generateMetadata } from './page';

// The page is rendered by Next (E2E, e2e/product-detail.spec.ts and e2e/product-seo.spec.ts); here its shape. The
// product view inside the <Suspense> is an async Server Component: the test calls it as a function and reads the
// element it returns. The DAL, notFound and the functions of next-intl are the seams of the page.
const { getStoreProduct, getTranslations, notFound, setRequestLocale } = vi.hoisted(() => ({
  getStoreProduct: vi.fn<(slug: string) => Promise<StoreProduct | null>>(),
  getTranslations:
    vi.fn<
      (scope: string | { locale: string; namespace: string }) => Promise<(key: string) => string>
    >(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  setRequestLocale: vi.fn(),
}));
vi.mock('~/features/product/server/get-product', () => ({ getStoreProduct }));
vi.mock('next/navigation', () => ({ notFound }));
vi.mock('next-intl/server', () => ({ getTranslations, setRequestLocale }));
// next-intl's createNavigation imports `next/navigation`, which Vitest cannot resolve: a faithful getPathname stub, as in
// alternates.test.ts (localePrefix 'always'). The real one is checked by the E2E of AC27.
vi.mock('~/i18n/navigation', () => ({
  Link: () => null,
  getPathname: ({ locale, href }: { locale: string; href: string }) =>
    href === '/' ? `/${locale}` : `/${locale}${href}`,
}));

const SITE_DESCRIPTION = 'Câu chung của site.';

const shirt: StoreProduct = {
  id: '019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f',
  name: 'Áo thun cổ tròn',
  slug: 'ao-thun-co-tron',
  price: 200000,
  compareAtPrice: 250000,
  availability: 'IN_STOCK',
  description: 'Áo thun cotton 100%.\nCổ tròn, tay ngắn.',
  updatedAt: '2026-11-16T02:15:30.000Z',
  category: null,
};

type Params = Promise<{ locale: string; slug: string }>;

const pageOf = (params: Params) =>
  ProductPage({ params }) as ReactElement<{ className: string; children: ReactNode }>;

/** The only <Suspense> of the page, and the element inside it. */
function boundaryOf(page: ReactElement<{ children: ReactNode }>) {
  const [boundary] = Children.toArray(page.props.children);
  if (!isValidElement<{ fallback: ReactNode; children: ReactNode }>(boundary)) {
    throw new Error('no element');
  }
  const [view] = Children.toArray(boundary.props.children);
  if (!isValidElement<{ params: Params }>(view)) throw new Error('no view');
  return { boundary, view };
}

/** Runs the async view inside the boundary, as React would. */
async function renderView(params: Params) {
  const { view } = boundaryOf(pageOf(params));
  const render = view.type as (props: { params: Params }) => Promise<ReactElement>;
  return render(view.props);
}

/**
 * The elements the view returns: the JSON-LD `Product`, the JSON-LD `BreadcrumbList` and the breadcrumb of S8.2 from the
 * same crumbs, then the product.
 */
async function partsOf(params: Params) {
  const element = await renderView(params);
  if (element.type !== Fragment) throw new Error('not a fragment');
  const [ld, breadcrumbLd, breadcrumb, detail] = Children.toArray(
    (element.props as { children: ReactNode }).children,
  );
  if (
    !isValidElement<{ data: unknown }>(ld) ||
    !isValidElement<{ data: unknown }>(breadcrumbLd) ||
    !isValidElement<{ items: unknown; label: string }>(breadcrumb) ||
    !isValidElement<{ product: StoreProduct }>(detail)
  ) {
    throw new Error('no parts');
  }
  return { ld, breadcrumbLd, breadcrumb, detail };
}

/** The words the page reads, by namespace: the site sentence and Home of Seo, the name of the breadcrumb. */
const MESSAGES: Record<string, Record<string, string>> = {
  Seo: { siteDescription: SITE_DESCRIPTION, home: 'Trang chủ' },
  Breadcrumb: { label: 'Đường dẫn trang' },
};

beforeEach(() => {
  getStoreProduct.mockResolvedValue(shirt);
  getTranslations.mockImplementation((scope) => {
    const namespace = typeof scope === 'string' ? scope : scope.namespace;
    return Promise.resolve((key) => MESSAGES[namespace]?.[key] ?? key);
  });
});

test('is a <main> wider than other pages, for the two columns of S5', () => {
  const page = pageOf(Promise.resolve({ locale: 'vi', slug: 'ao-thun-co-tron' }));

  expect(page.type).toBe('main');
  expect(page.props.className).toBe('product-page');
});

test('reads params and the product only inside a <Suspense>, with the skeleton as fallback', () => {
  const params = Promise.resolve({ locale: 'vi', slug: 'ao-thun-co-tron' });

  const { boundary, view } = boundaryOf(pageOf(params));

  expect(boundary.type).toBe(Suspense);
  expect(isValidElement(boundary.props.fallback) && boundary.props.fallback.type).toBe(
    ProductDetailSkeleton,
  );
  expect(view.props.params).toBe(params);
  expect(getStoreProduct).not.toHaveBeenCalled();
});

test('shows the product of the slug, in the locale of the path', async () => {
  const { detail } = await partsOf(Promise.resolve({ locale: 'en', slug: 'ao-thun-co-tron' }));

  expect(setRequestLocale).toHaveBeenCalledWith('en');
  expect(getStoreProduct).toHaveBeenCalledWith('ao-thun-co-tron');
  expect(detail.type).toBe(ProductDetail);
  expect(detail.props.product).toBe(shirt);
});

test('adds a JSON-LD Product at the stored slug, in the locale of the path (AC27)', async () => {
  const { ld } = await partsOf(Promise.resolve({ locale: 'en', slug: 'AO-THUN-CO-TRON' }));

  expect(ld.type).toBe(JsonLd);
  expect(ld.props.data).toEqual({
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Áo thun cổ tròn',
    description: 'Áo thun cotton 100%.\nCổ tròn, tay ngắn.',
    url: 'https://site.example.test/en/products/ao-thun-co-tron',
    offers: {
      '@type': 'Offer',
      price: 200000,
      priceCurrency: 'VND',
      availability: 'https://schema.org/InStock',
    },
  });
});

test('gives the JSON-LD of an out-of-stock product with no description the sentence of the site', async () => {
  getStoreProduct.mockResolvedValue({ ...shirt, availability: 'OUT_OF_STOCK', description: null });

  const { ld } = await partsOf(Promise.resolve({ locale: 'vi', slug: 'ao-thun-co-tron' }));

  expect(ld.props.data).toMatchObject({
    description: SITE_DESCRIPTION,
    offers: { availability: 'https://schema.org/OutOfStock' },
  });
});

test('gives the JSON-LD of a product with a blank description the sentence of the site, as its meta description', async () => {
  // A blank description is no description, for the JSON-LD as for the meta description (review of PR #57).
  getStoreProduct.mockResolvedValue({ ...shirt, description: '  ' });

  const { ld } = await partsOf(Promise.resolve({ locale: 'vi', slug: 'ao-thun-co-tron' }));
  const metadata = await generateMetadata({
    params: Promise.resolve({ locale: 'vi', slug: 'ao-thun-co-tron' }),
  });

  expect(ld.props.data).toMatchObject({ description: SITE_DESCRIPTION });
  expect(metadata.description).toBe(SITE_DESCRIPTION);
});

test('calls notFound when the store has no product at the slug', async () => {
  getStoreProduct.mockResolvedValue(null);

  await expect(renderView(Promise.resolve({ locale: 'vi', slug: 'khong-co' }))).rejects.toThrow(
    'NEXT_NOT_FOUND',
  );
  expect(notFound).toHaveBeenCalled();
});

test('lets an error of the api through to the error boundary, never a 404 (NFR26)', async () => {
  getStoreProduct.mockRejectedValue(new ApiError({ kind: 'http', status: 500, message: 'boom' }));

  await expect(
    renderView(Promise.resolve({ locale: 'vi', slug: 'ao-thun-co-tron' })),
  ).rejects.toMatchObject({ status: 500 });
  expect(notFound).not.toHaveBeenCalled();
});

describe('generateMetadata', () => {
  const metadataOf = (locale: string, slug: string) =>
    generateMetadata({ params: Promise.resolve({ locale, slug }) });

  test('titles the page "‹name› | ‹site›", outside the template of the root layout (AC27)', async () => {
    const metadata = await metadataOf('vi', 'ao-thun-co-tron');

    expect(metadata.title).toEqual({ absolute: 'Áo thun cổ tròn | tungph7 codebase' });
  });

  test('describes the page with the description, its line breaks folded (AC27)', async () => {
    const metadata = await metadataOf('vi', 'ao-thun-co-tron');

    expect(metadata.description).toBe('Áo thun cotton 100%. Cổ tròn, tay ngắn.');
  });

  test('keeps the first 160 characters of a long description', async () => {
    getStoreProduct.mockResolvedValue({ ...shirt, description: 'a'.repeat(5000) });

    const metadata = await metadataOf('vi', 'ao-thun-co-tron');

    expect(metadata.description).toBe('a'.repeat(160));
  });

  test('describes a product with no description with the sentence of the site, in the locale of the path', async () => {
    getStoreProduct.mockResolvedValue({ ...shirt, description: null });

    const metadata = await metadataOf('en', 'ao-thun-co-tron');

    expect(getTranslations).toHaveBeenCalledWith({ locale: 'en', namespace: 'Seo' });
    expect(metadata.description).toBe(SITE_DESCRIPTION);
  });

  test('has a canonical at the stored slug and hreflang vi, en and x-default (AC27)', async () => {
    const metadata = await metadataOf('en', 'AO-THUN-CO-TRON');

    expect(getStoreProduct).toHaveBeenCalledWith('AO-THUN-CO-TRON');
    expect(metadata.alternates).toEqual({
      canonical: '/en/products/ao-thun-co-tron',
      languages: {
        en: '/en/products/ao-thun-co-tron',
        vi: '/vi/products/ao-thun-co-tron',
        'x-default': '/vi/products/ao-thun-co-tron',
      },
    });
    expect(metadata.robots).toBeUndefined();
  });

  test('calls notFound when the store has no product at the slug', async () => {
    getStoreProduct.mockResolvedValue(null);

    await expect(metadataOf('vi', 'khong-co')).rejects.toThrow('NEXT_NOT_FOUND');
  });

  test('lets an error of the api through, never a 404 (NFR26)', async () => {
    getStoreProduct.mockRejectedValue(new ApiError({ kind: 'http', status: 503, message: 'boom' }));

    await expect(metadataOf('vi', 'ao-thun-co-tron')).rejects.toMatchObject({ status: 503 });
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe('the breadcrumb S8.2 of SHOP-81', () => {
  const ao = { name: 'Áo', slug: 'ao' };

  test('shows Trang chủ › Áo › Áo thun cổ tròn above the back link, named "Đường dẫn trang" (AC20)', async () => {
    getStoreProduct.mockResolvedValue({ ...shirt, category: ao });

    const { breadcrumb, detail } = await partsOf(
      Promise.resolve({ locale: 'vi', slug: 'AO-THUN-CO-TRON' }),
    );

    expect(breadcrumb.type).toBe(Breadcrumb);
    expect(breadcrumb.props).toEqual({
      items: [
        { name: 'Trang chủ', url: 'https://site.example.test/vi' },
        { name: 'Áo', url: 'https://site.example.test/vi/categories/ao' },
        { name: 'Áo thun cổ tròn', url: 'https://site.example.test/vi/products/ao-thun-co-tron' },
      ],
      label: 'Đường dẫn trang',
    });
    // The back link "← Sản phẩm" of S8.3 is the first element of ProductDetail, so it stays under the breadcrumb.
    expect(detail.type).toBe(ProductDetail);
  });

  test('adds a JSON-LD BreadcrumbList of the same three crumbs, with absolute URLs of the locale of the page (AC20)', async () => {
    getStoreProduct.mockResolvedValue({ ...shirt, category: ao });

    const { ld, breadcrumbLd } = await partsOf(
      Promise.resolve({ locale: 'en', slug: 'ao-thun-co-tron' }),
    );

    expect(breadcrumbLd.type).toBe(JsonLd);
    expect(breadcrumbLd.props.data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Trang chủ',
          item: 'https://site.example.test/en',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Áo',
          item: 'https://site.example.test/en/categories/ao',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Áo thun cổ tròn',
          item: 'https://site.example.test/en/products/ao-thun-co-tron',
        },
      ],
    });
    // The JSON-LD Product of SHOP-7 stays, a block of its own.
    expect(ld.props.data).toMatchObject({ '@type': 'Product' });
  });

  test('has two crumbs, Trang chủ › the product, for a product with no category or a hidden one (AC21)', async () => {
    getStoreProduct.mockResolvedValue({ ...shirt, category: null });

    const { breadcrumb, breadcrumbLd } = await partsOf(
      Promise.resolve({ locale: 'vi', slug: 'ao-thun-co-tron' }),
    );

    const crumbs = [
      { name: 'Trang chủ', url: 'https://site.example.test/vi' },
      { name: 'Áo thun cổ tròn', url: 'https://site.example.test/vi/products/ao-thun-co-tron' },
    ];
    expect(breadcrumb.props.items).toEqual(crumbs);
    expect(breadcrumbLd.props.data).toMatchObject({
      itemListElement: [
        { position: 1, name: 'Trang chủ', item: crumbs[0]?.url },
        { position: 2, name: 'Áo thun cổ tròn', item: crumbs[1]?.url },
      ],
    });
  });

  test('reads the category only from the product, with no other request (NFR6)', async () => {
    getStoreProduct.mockResolvedValue({ ...shirt, category: ao });

    await partsOf(Promise.resolve({ locale: 'vi', slug: 'ao-thun-co-tron' }));

    expect(getStoreProduct).toHaveBeenCalledTimes(1);
  });
});
