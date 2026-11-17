// @vitest-environment node
import { beforeEach, expect, test, vi } from 'vitest';

import type { SitemapEntry } from '~/features/product/model/product';
import { ApiError } from '~/lib/http/api-error';

import sitemap from './sitemap';

// `/sitemap.xml` is rendered by Next (E2E, e2e/product-seo.spec.ts); here the entries it is built from. The DAL and
// connection() are the seams: connection() is what keeps the sitemap out of the prerender, so `next build` never calls
// the api.
const { connection, getSitemapEntries } = vi.hoisted(() => ({
  connection: vi.fn(() => Promise.resolve()),
  getSitemapEntries: vi.fn<() => Promise<SitemapEntry[]>>(),
}));
vi.mock('next/server', () => ({ connection }));
vi.mock('~/features/product/server/get-sitemap-entries', () => ({ getSitemapEntries }));
// next-intl's createNavigation imports `next/navigation`, which Vitest cannot resolve: a faithful getPathname stub, as
// in alternates.test.ts (localePrefix 'always'). The real one is checked by the E2E on /sitemap.xml.
vi.mock('~/i18n/navigation', () => ({
  getPathname: ({ locale, href }: { locale: string; href: string }) =>
    href === '/' ? `/${locale}` : `/${locale}${href}`,
}));

const SITE = 'https://site.example.test';

const shirt: SitemapEntry = { slug: 'ao-thun-co-tron', updatedAt: '2026-11-16T02:15:30.123Z' };
const jeans: SitemapEntry = { slug: 'quan-jean-nam', updatedAt: '2026-11-17T08:00:00.000Z' };

beforeEach(() => {
  getSitemapEntries.mockResolvedValue([shirt, jeans]);
});

test('waits for a request before it reads the products, so the build never calls the api', async () => {
  const order: string[] = [];
  connection.mockImplementation(() => {
    order.push('connection');
    return Promise.resolve();
  });
  getSitemapEntries.mockImplementation(() => {
    order.push('products');
    return Promise.resolve([]);
  });

  await sitemap();

  expect(order).toEqual(['connection', 'products']);
});

test('keeps the public pages at their address in the default locale, en, with their vi and en addresses', async () => {
  const entries = await sitemap();

  expect(entries.slice(0, 3)).toEqual([
    {
      url: `${SITE}/en`,
      changeFrequency: 'weekly',
      priority: 1,
      alternates: { languages: { vi: `${SITE}/vi`, en: `${SITE}/en` } },
    },
    {
      url: `${SITE}/en/about`,
      changeFrequency: 'monthly',
      priority: 0.6,
      alternates: { languages: { vi: `${SITE}/vi/about`, en: `${SITE}/en/about` } },
    },
    {
      url: `${SITE}/en/products`,
      changeFrequency: 'daily',
      priority: 0.8,
      alternates: { languages: { vi: `${SITE}/vi/products`, en: `${SITE}/en/products` } },
    },
  ]);
});

test('lists the page of each product on sale, with hreflang vi and en and its last edit as lastmod (AC28)', async () => {
  const entries = await sitemap();

  expect(entries.slice(3)).toEqual([
    {
      url: `${SITE}/en/products/ao-thun-co-tron`,
      lastModified: '2026-11-16T02:15:30.123Z',
      alternates: {
        languages: {
          vi: `${SITE}/vi/products/ao-thun-co-tron`,
          en: `${SITE}/en/products/ao-thun-co-tron`,
        },
      },
    },
    {
      url: `${SITE}/en/products/quan-jean-nam`,
      lastModified: '2026-11-17T08:00:00.000Z',
      alternates: {
        languages: {
          vi: `${SITE}/vi/products/quan-jean-nam`,
          en: `${SITE}/en/products/quan-jean-nam`,
        },
      },
    },
  ]);
});

test('lets an error of the api through, so the sitemap is a 5xx and never short of products (NFR26)', async () => {
  getSitemapEntries.mockRejectedValue(new ApiError({ kind: 'http', status: 500, message: 'boom' }));

  await expect(sitemap()).rejects.toMatchObject({ status: 500 });
});
