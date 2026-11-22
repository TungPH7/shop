import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from '@playwright/test';

import en from '../messages/en.json';
import vi from '../messages/vi.json';

import {
  createCategory,
  deleteCategory,
  deleteStaleCategories,
  type CategoryInput,
  type CreatedCategory,
} from './support/categories';
import {
  adminApi,
  adminUrlFor,
  createProduct,
  deleteProduct,
  deleteStaleProducts,
  newRunId,
  type CreatedProduct,
  type ProductInput,
} from './support/products';

// The run id of this file only, in the names (so the slugs) of its categories and products: see newRunId.
const runId = newRunId();

// The SEO of S5 of SHOP-81 (AC18) and the categories of /sitemap.xml (AC19), on the real api, read in the raw HTML of
// the first response as a search engine reads it, point by point as "Kiểm" of the SEO section of the SPEC, S5. The
// tests create their data through the admin API and delete it when done (TW3); they share it, so they run in order.
test.describe.configure({ mode: 'default' });

/** A change reaches the pages and the sitemap within 60 s at most (NFR6). */
const CACHE_WAIT = { timeout: 60_000, intervals: [1_000, 2_000, 5_000] };

const SUFFIX = ' · tungph7 codebase';
const MESSAGES = { vi, en } as const;
const HOME = { vi: 'Trang chủ', en: 'Home' } as const;
const SCRIPT_NAME = '</script><script>alert(1)</script>';

type Locale = 'vi' | 'en';

let api: APIRequestContext;
let ao: CreatedCategory;
let empty: CreatedCategory;
let hidden: CreatedCategory;
let onlyHidden: CreatedCategory;
let deleted: CreatedCategory;
let scripted: CreatedCategory;
let shirt: CreatedProduct;
/** The products on sale of "Áo", whose last edit counts for the lastmod of the category (AC19). */
const aoProducts: CreatedProduct[] = [];
const products: CreatedProduct[] = [];
const categories: CreatedCategory[] = [];

test.beforeAll(async ({}, testInfo) => {
  api = await adminApi(adminUrlFor(testInfo.project.use.baseURL));
  await deleteStaleProducts(api);
  await deleteStaleCategories(api);
  const category = async (input: CategoryInput) => {
    const created = await createCategory(api, runId, input);
    categories.push(created);
    return created;
  };
  const product = async (input: ProductInput) => {
    const created = await createProduct(api, runId, input);
    products.push(created);
    return created;
  };

  ao = await category({ name: 'Áo' });
  empty = await category({ name: 'Phụ kiện' });
  hidden = await category({ name: 'Ẩn', status: 'HIDDEN' });
  onlyHidden = await category({ name: 'Đầm' });
  deleted = await category({ name: 'Đã xóa' });
  scripted = await category({ name: SCRIPT_NAME });
  shirt = await product({ name: 'Áo thun cổ tròn', price: 200000, categoryId: ao.id });
  aoProducts.push(shirt, await product({ name: 'Áo len', price: 300000, categoryId: ao.id }));
  await product({ name: 'Khăn ẩn', price: 90000, categoryId: hidden.id });
  await product({ name: 'Đầm hoa', price: 400000, status: 'HIDDEN', categoryId: onlyHidden.id });
  await product({ name: 'Mũ xóa', price: 90000, categoryId: deleted.id });
  await product({ name: 'Áo script', price: 120000, categoryId: scripted.id });
  await deleteCategory(api, deleted.id);
});

test.afterAll(async () => {
  for (const product of products) await deleteProduct(api, product.id);
  for (const category of categories) await deleteCategory(api, category.id);
  await api.dispose();
});

/** The tier of the title the SEO section picks: the first that fits 60 characters with the suffix. */
function titleOf(locale: Locale, name: string): string {
  const { titleLong, titleShort } = MESSAGES[locale].Category;
  const tiers = [titleLong, titleShort].map((tier) => tier.replace('{name}', name));
  return tiers.find((tier) => tier.length + SUFFIX.length <= 60) ?? name;
}

/** Sentence 1, then sentence 2 when both fit 160 characters. */
function descriptionOf(locale: Locale, name: string): string {
  const { metaDescription1, metaDescription2 } = MESSAGES[locale].Category;
  const both = `${metaDescription1.replace('{name}', name)} ${metaDescription2}`;
  return both.length <= 160 ? both : metaDescription1.replace('{name}', name);
}

/** The raw HTML of `path`, as the server sends it, once the page shows products of the category (NFR6). */
async function rawHtml(
  page: Page,
  path: string,
  mustHold: string,
): Promise<{ response: APIResponse; html: string }> {
  let response: APIResponse | undefined;
  let html = '';
  await expect
    .poll(async () => {
      response = await page.request.get(path);
      html = await response.text();
      return html.includes(mustHold);
    }, CACHE_WAIT)
    .toBe(true);
  if (!response) throw new Error('no response');
  return { response, html };
}

const decode = (text: string) =>
  text
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const pathOf = (url: string | undefined) => (url ? new URL(url).pathname : undefined);

/** The `href` of the first `<link>` whose attributes match `attributes`. */
function linkHref(html: string, attributes: RegExp): string | undefined {
  const tag = [...html.matchAll(/<link\b[^>]*>/g)].map(([t]) => t).find((t) => attributes.test(t));
  return tag ? decode(/href="([^"]*)"/.exec(tag)?.[1] ?? '') : undefined;
}

type BreadcrumbLd = {
  '@type': string;
  itemListElement: { position: number; name: string; item: string }[];
};

/** The JSON-LD blocks of the HTML, raw and parsed. */
function jsonLdBlocks(html: string) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    ([, raw = '']) => ({ raw, data: JSON.parse(raw) as BreadcrumbLd }),
  );
}

for (const locale of ['vi', 'en'] as const) {
  for (const query of ['', '?sort=price-asc&page=2']) {
    test(`AC18 gives /${locale}/categories/{slug}${query} its h1, lang, title, description, canonical, hreflang and BreadcrumbList`, async ({
      page,
    }) => {
      const { response, html } = await rawHtml(
        page,
        `/${locale}/categories/${ao.slug}${query}`,
        shirt.name,
      );
      expect(response.status()).toBe(200);

      // 1. One h1, the name of the category; the lang of the path.
      const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map(([, text]) => text);
      expect(headings).toEqual([ao.name]);
      expect(html).toMatch(new RegExp(`<html lang="${locale}"`));

      // 2. The title of the tier, with the suffix; the meta description with the name.
      const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
      expect(decode(title ?? '')).toBe(`${titleOf(locale, ao.name)}${SUFFIX}`);
      expect(decode(title ?? '').length).toBeLessThanOrEqual(60);
      const description = decode(
        /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? '',
      );
      expect(description).toBe(descriptionOf(locale, ao.name));
      expect(description.length).toBeLessThanOrEqual(160);

      // 3. The canonical: the page itself in this locale, at the stored slug, with no parameter; hreflang vi, en and
      // x-default, which points at /vi (SPEC of SHOP-81, section SEO).
      expect(pathOf(linkHref(html, /rel="canonical"/))).toBe(`/${locale}/categories/${ao.slug}`);
      expect(new URL(linkHref(html, /rel="canonical"/) ?? '').search).toBe('');
      for (const [hreflang, path] of [
        ['vi', `/vi/categories/${ao.slug}`],
        ['en', `/en/categories/${ao.slug}`],
        ['x-default', `/vi/categories/${ao.slug}`],
      ] as const) {
        expect(pathOf(linkHref(html, new RegExp(`hrefLang="${hreflang}"`, 'i')))).toBe(path);
      }

      // 4. One BreadcrumbList of two crumbs, absolute URLs of this locale, matching the trail on the page; no raw `<`.
      const breadcrumbs = jsonLdBlocks(html).filter(
        ({ data }) => data['@type'] === 'BreadcrumbList',
      );
      expect(breadcrumbs).toHaveLength(1);
      const [{ raw, data }] = breadcrumbs as [(typeof breadcrumbs)[number]];
      expect(raw).not.toContain('<');
      expect(data.itemListElement.map(({ position, name }) => [position, name])).toEqual([
        [1, HOME[locale]],
        [2, ao.name],
      ]);
      expect(data.itemListElement.map(({ item }) => pathOf(item))).toEqual([
        `/${locale}`,
        `/${locale}/categories/${ao.slug}`,
      ]);
      expect(data.itemListElement.every(({ item }) => /^https?:\/\//.test(item))).toBe(true);

      // 6. A category with products on sale has no robots noindex.
      expect(html).not.toMatch(/<meta name="robots" content="noindex/);
      // 8. A product of the category in the raw HTML, not only after JavaScript.
      expect(html).toContain(shirt.name);
    });
  }
}

test('AC18 gives the canonical of the stored slug to a path in capitals', async ({ page }) => {
  const { html } = await rawHtml(page, `/vi/categories/${ao.slug.toUpperCase()}`, shirt.name);

  expect(pathOf(linkHref(html, /rel="canonical"/))).toBe(`/vi/categories/${ao.slug}`);
});

for (const locale of ['vi', 'en'] as const) {
  test(`AC18 shows the breadcrumb ${HOME[locale]} › ‹name›, ${HOME[locale]} a link to the home page, in ${locale}`, async ({
    page,
  }) => {
    await expect(async () => {
      await page.goto(`/${locale}/categories/${ao.slug}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(ao.name, { timeout: 2_000 });
    }).toPass(CACHE_WAIT);

    const trail = page.getByRole('navigation', { name: MESSAGES[locale].Breadcrumb.label });
    await expect(trail.getByRole('listitem')).toHaveCount(2);
    await expect(trail.getByRole('link', { name: HOME[locale] })).toHaveAttribute(
      'href',
      `/${locale}`,
    );
    await expect(trail.getByRole('link')).toHaveCount(1);
    await expect(trail.getByText(ao.name)).toHaveAttribute('aria-current', 'page');
  });
}

test('AC18 sets noindex and no canonical on a visible category with no product on sale, with 200 (AC15)', async ({
  page,
}) => {
  const { response, html } = await rawHtml(
    page,
    `/vi/categories/${empty.slug}`,
    MESSAGES.vi.Category.empty,
  );

  expect(response.status()).toBe(200);
  expect(html).toMatch(/<meta name="robots" content="noindex, nofollow"/);
  expect(linkHref(html, /rel="canonical"/)).toBeUndefined();
  expect(linkHref(html, /hrefLang=/i)).toBeUndefined();
});

test('AC18 keeps a category named </script><script>alert(1)</script> as text in the title, the meta and the JSON-LD (NFR10)', async ({
  page,
}) => {
  const dialogs: string[] = [];
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message());
    void dialog.dismiss();
  });
  const { html } = await rawHtml(page, `/vi/categories/${scripted.slug}`, 'Áo script');

  // No tag opens in the JSON-LD: its `<` are <.
  for (const { raw } of jsonLdBlocks(html)) expect(raw).not.toContain('<');
  // The title and the meta hold the name escaped, never a tag.
  expect(html).not.toContain(`<title>${SCRIPT_NAME}`);
  expect(decode(/<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '')).toBe(`${scripted.name}${SUFFIX}`);
  expect(html.match(/<script><\/script>|<script>alert\(1\)<\/script>/g)).toBeNull();

  await page.goto(`/vi/categories/${scripted.slug}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(scripted.name);
  await expect(page).toHaveTitle(`${scripted.name}${SUFFIX}`);
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

test('AC19 lists a visible category with a product on sale in /sitemap.xml, with hreflang vi, en and its lastmod, and not the others', async ({
  request,
}) => {
  test.setTimeout(90_000);
  const path = `/en/categories/${ao.slug}`;
  let urls: SitemapUrl[] = [];

  await expect
    .poll(async () => {
      const response = await request.get('/sitemap.xml');
      expect(response.status()).toBe(200);
      urls = parseSitemap(await response.text());
      return urls.some((url) => new URL(url.loc).pathname === path);
    }, CACHE_WAIT)
    .toBe(true);

  const entry = urls.find((url) => new URL(url.loc).pathname === path);
  expect(pathOf(entry?.languages.vi)).toBe(`/vi/categories/${ao.slug}`);
  expect(pathOf(entry?.languages.en)).toBe(`/en/categories/${ao.slug}`);
  // The later of the last edit of the category and of its products on sale.
  const latest = Math.max(
    Date.parse(ao.updatedAt),
    ...aoProducts.map((product) => Date.parse(product.updatedAt)),
  );
  expect(Date.parse(entry?.lastmod ?? '')).toBe(latest);
  const all = urls.flatMap((url) => [url.loc, ...Object.values(url.languages)]);
  for (const other of [empty, hidden, onlyHidden, deleted]) {
    expect(all.filter((url) => url.endsWith(`/categories/${other.slug}`))).toEqual([]);
  }
});

test('AC19 robots.txt does not block the category pages', async ({ request }) => {
  const robots = await (await request.get('/robots.txt')).text();

  expect(robots).not.toMatch(/Disallow:\s*\/(vi|en)?\/?categories/i);
});
