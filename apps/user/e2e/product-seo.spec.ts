import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import en from '../messages/en.json';
import vi from '../messages/vi.json';

import {
  adminApi,
  adminUrlFor,
  createProduct,
  deleteProduct,
  deleteStaleProducts,
  type CreatedProduct,
  type ProductInput,
} from './support/products';

// The meta tags and JSON-LD of S5 (AC27) and the products of /sitemap.xml (AC28), SHOP-31, on the real api: each test
// reads products this file creates through the admin API and deletes when done (NFR23). The tests share those products,
// so they run in order in one worker.
test.describe.configure({ mode: 'default' });

const SITE_NAME = 'tungph7 codebase';
const SITE_DESCRIPTION = { vi: vi.Seo.siteDescription, en: en.Seo.siteDescription } as const;

const TWO_LINES = 'Áo thun cotton 100%.\nCổ tròn, tay ngắn.';
const SCRIPT_DESCRIPTION = '</script><script>alert(1)</script>';
const LONG_DESCRIPTION = `${'Vải cotton dày dặn, '.repeat(12)}mặc mát.`;

let api: APIRequestContext;
let shirt: CreatedProduct;
let scripted: CreatedProduct;
let soldOut: CreatedProduct;
let long: CreatedProduct;
let hidden: CreatedProduct;
/** What beforeAll created, deleted in afterAll even when beforeAll stops half-way. */
const created: CreatedProduct[] = [];

test.beforeAll(async ({}, testInfo) => {
  api = await adminApi(adminUrlFor(testInfo.project.use.baseURL));
  await deleteStaleProducts(api);
  const create = async (input: ProductInput) => {
    const product = await createProduct(api, input);
    created.push(product);
    return product;
  };
  shirt = await create({ name: 'Áo thun cổ tròn', price: 200000, description: TWO_LINES });
  scripted = await create({ name: 'Áo khoác', price: 300000, description: SCRIPT_DESCRIPTION });
  soldOut = await create({ name: 'Quần jean nam', price: 450000, availability: 'OUT_OF_STOCK' });
  long = await create({ name: 'Áo polo', price: 350000, description: LONG_DESCRIPTION });
  hidden = await create({ name: 'Áo ẩn', price: 150000, status: 'HIDDEN' });
});

test.afterAll(async () => {
  for (const product of created) await deleteProduct(api, product.id);
  await api.dispose();
});

type ProductLd = {
  '@context': string;
  '@type': string;
  name: string;
  description: string;
  url: string;
  offers: { '@type': string; price: unknown; priceCurrency: string; availability: string };
};

/** Opens S5 of `product` and waits for the product, past which the metadata has streamed in too. */
async function openProduct(page: Page, locale: 'vi' | 'en', product: CreatedProduct) {
  await page.goto(`/${locale}/products/${product.slug}`);
  await expect(page.getByRole('heading', { level: 1, name: product.name })).toBeVisible();
}

/** The JSON-LD blocks of the page whose `@type` is Product, parsed. */
async function productLdOf(page: Page): Promise<ProductLd[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks
    .map((text) => JSON.parse(text) as { '@type': string })
    .filter((data): data is ProductLd => data['@type'] === 'Product');
}

const pathOf = (url: string | null) => (url ? new URL(url).pathname : null);

for (const locale of ['vi', 'en'] as const) {
  test(`AC27 gives a product on sale its title, meta description, canonical, hreflang and Product JSON-LD in ${locale}`, async ({
    page,
  }) => {
    await openProduct(page, locale, shirt);

    await expect(page).toHaveTitle(`${shirt.name} | ${SITE_NAME}`);
    const description = page.locator('meta[name="description"]');
    await expect(description).toHaveCount(1);
    await expect(description).toHaveAttribute('content', 'Áo thun cotton 100%. Cổ tròn, tay ngắn.');

    const path = `/${locale}/products/${shirt.slug}`;
    expect(pathOf(await page.locator('link[rel="canonical"]').getAttribute('href'))).toBe(path);
    for (const language of ['vi', 'en'] as const) {
      const alternate = page.locator(`link[rel="alternate"][hreflang="${language}"]`);
      await expect(alternate).toHaveCount(1);
      expect(pathOf(await alternate.getAttribute('href'))).toBe(
        `/${language}/products/${shirt.slug}`,
      );
    }

    const lds = await productLdOf(page);
    expect(lds).toHaveLength(1);
    const [ld] = lds;
    expect(ld).toMatchObject({
      '@context': 'https://schema.org',
      name: shirt.name,
      description: TWO_LINES,
      offers: {
        '@type': 'Offer',
        price: 200000,
        priceCurrency: 'VND',
        availability: 'https://schema.org/InStock',
      },
    });
    expect(Number.isInteger(ld?.offers.price)).toBe(true);
    expect(pathOf(ld?.url ?? null)).toBe(path);
    expect(ld).not.toHaveProperty('image');
  });
}

test('AC27 keeps the first 160 characters of a long description in the meta description', async ({
  page,
}) => {
  await openProduct(page, 'vi', long);

  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    // Graphemes, as the rule counts: a letter with its marks is one, however it is encoded.
    Array.from(new Intl.Segmenter('vi', { granularity: 'grapheme' }).segment(LONG_DESCRIPTION))
      .slice(0, 160)
      .map(({ segment }) => segment)
      .join('')
      .trimEnd(),
  );
});

for (const locale of ['vi', 'en'] as const) {
  test(`AC27 describes a product with no description with the sentence of the site and offers it OutOfStock in ${locale}`, async ({
    page,
  }) => {
    await openProduct(page, locale, soldOut);

    await expect(page).toHaveTitle(`${soldOut.name} | ${SITE_NAME}`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      SITE_DESCRIPTION[locale],
    );
    const [ld] = await productLdOf(page);
    expect(ld).toMatchObject({
      description: SITE_DESCRIPTION[locale],
      offers: { price: 450000, availability: 'https://schema.org/OutOfStock' },
    });
  });
}

test('AC27 keeps a description holding </script><script> as text, in the meta tag and the JSON-LD, with no script run (NFR11)', async ({
  page,
}) => {
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });

  await openProduct(page, 'vi', scripted);

  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    SCRIPT_DESCRIPTION,
  );
  const [ld] = await productLdOf(page);
  expect(ld?.description).toBe(SCRIPT_DESCRIPTION);
  // The block holds `</script>`, so it never closes early, and no script of the page runs alert(1).
  const scripts = await page.locator('script').allTextContents();
  expect(scripts.filter((text) => text.trim() === 'alert(1)')).toEqual([]);
  expect(dialogs).toEqual([]);
});

/** One `<url>` of the sitemap: its `loc`, `lastmod` and hreflang links. */
type SitemapUrl = { loc: string; lastmod: string | null; languages: Record<string, string> };

function parseSitemap(xml: string): SitemapUrl[] {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, body = '']) => ({
    loc: /<loc>([^<]*)<\/loc>/.exec(body)?.[1] ?? '',
    lastmod: /<lastmod>([^<]*)<\/lastmod>/.exec(body)?.[1] ?? null,
    languages: Object.fromEntries(
      [...body.matchAll(/<xhtml:link[^>]*hreflang="([^"]+)"[^>]*href="([^"]+)"/g)].map(
        ([, language = '', href = '']) => [language, href],
      ),
    ),
  }));
}

test('AC28 lists the products on sale in /sitemap.xml with hreflang vi, en and their last edit, and no hidden product', async ({
  request,
}) => {
  // The poll below waits up to the 60 s of NFR7: the test needs more than the default 30 s around it.
  test.setTimeout(90_000);
  const pathOfLoc = (entry: SitemapUrl) => new URL(entry.loc).pathname;
  const productPaths = (slug: string) => [`/en/products/${slug}`, `/vi/products/${slug}`];
  let urls: SitemapUrl[] = [];

  // The sitemap reads the catalog with cacheLife('catalog'): a product added in beforeAll is there within 60 s (NFR7).
  await expect
    .poll(
      async () => {
        const response = await request.get('/sitemap.xml');
        expect(response.status()).toBe(200);
        urls = parseSitemap(await response.text());
        const paths = urls.map(pathOfLoc);
        return [shirt, soldOut].every((product) =>
          productPaths(product.slug).some((path) => paths.includes(path)),
        );
      },
      { timeout: 60_000, intervals: [1_000, 2_000, 5_000] },
    )
    .toBe(true);

  for (const product of [shirt, soldOut]) {
    const entry = urls.find((url) => productPaths(product.slug).includes(pathOfLoc(url)));
    expect(entry, product.slug).toBeDefined();
    expect(pathOf(entry?.languages.vi ?? null)).toBe(`/vi/products/${product.slug}`);
    expect(pathOf(entry?.languages.en ?? null)).toBe(`/en/products/${product.slug}`);
    expect(Date.parse(entry?.lastmod ?? '')).toBe(Date.parse(product.updatedAt));
  }
  const allPaths = urls.flatMap((url) => [url.loc, ...Object.values(url.languages)]);
  expect(allPaths.filter((url) => url.includes(hidden.slug))).toEqual([]);
});
