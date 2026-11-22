import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import {
  categoryName,
  createCategory,
  deleteCategory,
  deleteStaleCategories,
  updateCategory,
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
  setProductCategory,
  type CreatedProduct,
  type ProductInput,
} from './support/products';

// The run id of this file only, in the names (so the slugs) of its categories and products: see newRunId.
const runId = newRunId();

// The part of the store of AC5–AC9 of SHOP-81 (plan, Architecture Decisions 3): each test makes the change of the
// criterion through the admin API, as the form of admin would, then waits for the store to show it, within the 60 s of
// NFR6. The part of admin is the E2E of SHOP-83. The tests create their data and delete it when done (TW3).
test.describe.configure({ mode: 'default' });

/** Within 60 s (NFR6), asking again every few seconds. */
const WITHIN_60_S = { timeout: 60_000, intervals: [1_000, 2_000, 5_000] };

let api: APIRequestContext;
const products: CreatedProduct[] = [];
const categories: CreatedCategory[] = [];

test.beforeAll(async ({}, testInfo) => {
  api = await adminApi(adminUrlFor(testInfo.project.use.baseURL));
  await deleteStaleProducts(api);
  await deleteStaleCategories(api);
});

test.afterAll(async () => {
  for (const product of products) await deleteProduct(api, product.id);
  for (const category of categories) await deleteCategory(api, category.id);
  await api.dispose();
});

async function category(input: CategoryInput) {
  const created = await createCategory(api, runId, input);
  categories.push(created);
  return created;
}

async function product(input: ProductInput) {
  const created = await createProduct(api, runId, input);
  products.push(created);
  return created;
}

/** The HTTP status of a page load of `path`: the Proxy checks the slug on each one, never cached. */
const statusOf = async (page: Page, path: string) => (await page.request.get(path)).status();

/** The text of the h1 of the raw HTML of `path`. */
async function headingOf(page: Page, path: string): Promise<string | null> {
  const html = await (await page.request.get(path)).text();
  return /<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? null;
}

/** The names of the crumbs of the BreadcrumbList of the product page of `slug`. */
async function crumbsOf(page: Page, slug: string): Promise<string[]> {
  const html = await (await page.request.get(`/vi/products/${slug}`)).text();
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const [, raw = ''] of blocks) {
    const data = JSON.parse(raw) as { '@type': string; itemListElement?: { name: string }[] };
    if (data['@type'] === 'BreadcrumbList')
      return (data.itemListElement ?? []).map(({ name }) => name);
  }
  return [];
}

/** Whether the raw HTML of the category page of `slug` has a card of `name`. */
async function categoryShows(page: Page, slug: string, name: string): Promise<boolean> {
  const response = await page.request.get(`/vi/categories/${slug}`);
  return response.status() === 200 && (await response.text()).includes(name);
}

/** Whether the products page, searched for `name`, shows its card: the product list of the whole store. */
async function catalogShows(page: Page, name: string): Promise<boolean> {
  const html = await (await page.request.get(`/vi/products?q=${encodeURIComponent(name)}`)).text();
  return html.includes(`>${name}<`);
}

/** Whether the row of category links of the products page links to the category of `slug`. */
async function linksShow(page: Page, slug: string): Promise<boolean> {
  const html = await (await page.request.get('/vi/products')).text();
  return html.includes(`href="/vi/categories/${slug}"`);
}

/** Whether /sitemap.xml has the page of the category of `slug`. */
async function sitemapShows(page: Page, slug: string): Promise<boolean> {
  const xml = await (await page.request.get('/sitemap.xml')).text();
  return xml.includes(`/categories/${slug}<`);
}

test('AC5 shows the new name of a category within 60 s, then its new slug, with the old one answering 404', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const ao = await category({ name: 'Áo' });
  await product({ name: 'Áo thun cổ tròn', price: 200000, categoryId: ao.id });
  const oldPath = `/vi/categories/${ao.slug}`;
  await expect.poll(() => headingOf(page, oldPath), WITHIN_60_S).toBe(ao.name);

  const renamed = await updateCategory(api, ao, { name: categoryName('Áo nam', runId) });

  expect(renamed.slug).toBe(ao.slug);
  await expect.poll(() => headingOf(page, oldPath), WITHIN_60_S).toBe(renamed.name);

  const moved = await updateCategory(api, renamed, { slug: `ao-nam-e2e-${runId}` });

  await expect.poll(() => statusOf(page, `/vi/categories/${moved.slug}`), WITHIN_60_S).toBe(200);
  await expect.poll(() => statusOf(page, oldPath), WITHIN_60_S).toBe(404);
});

test('AC6 hides a category from every page of the store within 60 s, keeps its product, and shows it again at the same address', async ({
  page,
}) => {
  test.setTimeout(300_000);
  const ao = await category({ name: 'Áo ẩn hiện' });
  const shirt = await product({ name: 'Áo thun ẩn hiện', price: 200000, categoryId: ao.id });
  const path = `/vi/categories/${ao.slug}`;
  await expect.poll(() => linksShow(page, ao.slug), WITHIN_60_S).toBe(true);
  await expect
    .poll(() => crumbsOf(page, shirt.slug), WITHIN_60_S)
    .toEqual(['Trang chủ', ao.name, shirt.name]);

  const hidden = await updateCategory(api, ao, { status: 'HIDDEN' });

  await expect.poll(() => statusOf(page, path), WITHIN_60_S).toBe(404);
  await expect.poll(() => linksShow(page, ao.slug), WITHIN_60_S).toBe(false);
  await expect.poll(() => sitemapShows(page, ao.slug), WITHIN_60_S).toBe(false);
  await expect.poll(() => catalogShows(page, shirt.name), WITHIN_60_S).toBe(true);
  await expect
    .poll(() => crumbsOf(page, shirt.slug), WITHIN_60_S)
    .toEqual(['Trang chủ', shirt.name]);

  await updateCategory(api, hidden, { status: 'VISIBLE' });

  await expect.poll(() => statusOf(page, path), WITHIN_60_S).toBe(200);
  await expect.poll(() => categoryShows(page, ao.slug, shirt.name), WITHIN_60_S).toBe(true);
});

test('AC7 answers 404 for the page of a deleted category within 60 s', async ({ page }) => {
  test.setTimeout(120_000);
  const accessories = await category({ name: 'Phụ kiện xóa' });
  const path = `/vi/categories/${accessories.slug}`;
  await expect.poll(() => statusOf(page, path), WITHIN_60_S).toBe(200);

  await deleteCategory(api, accessories.id);

  await expect.poll(() => statusOf(page, path), WITHIN_60_S).toBe(404);
});

test('AC8 answers 404 for a deleted category with products within 60 s, keeps its product on sale and gives it two crumbs', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const ao = await category({ name: 'Áo xóa' });
  const shirt = await product({ name: 'Áo thun xóa', price: 200000, categoryId: ao.id });
  await product({ name: 'Áo len xóa', price: 300000, status: 'HIDDEN', categoryId: ao.id });
  const path = `/vi/categories/${ao.slug}`;
  await expect.poll(() => categoryShows(page, ao.slug, shirt.name), WITHIN_60_S).toBe(true);

  await deleteCategory(api, ao.id);

  await expect.poll(() => statusOf(page, path), WITHIN_60_S).toBe(404);
  await expect.poll(() => catalogShows(page, shirt.name), WITHIN_60_S).toBe(true);
  await expect
    .poll(() => crumbsOf(page, shirt.slug), WITHIN_60_S)
    .toEqual(['Trang chủ', shirt.name]);
});

test('AC9 shows a product on the page of its new category within 60 s, and no longer once it has none', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const ao = await category({ name: 'Áo gán' });
  const anchor = await product({ name: 'Áo có sẵn', price: 100000, categoryId: ao.id });
  const shirt = await product({ name: 'Áo thun gán', price: 200000 });
  await expect.poll(() => categoryShows(page, ao.slug, anchor.name), WITHIN_60_S).toBe(true);

  await setProductCategory(api, shirt.id, ao.id);

  await expect.poll(() => categoryShows(page, ao.slug, shirt.name), WITHIN_60_S).toBe(true);

  await setProductCategory(api, shirt.id, null);

  await expect.poll(() => categoryShows(page, ao.slug, shirt.name), WITHIN_60_S).toBe(false);
});
