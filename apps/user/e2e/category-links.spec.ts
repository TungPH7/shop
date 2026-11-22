import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

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

// S7 of SHOP-81, the row of category links of the products page (AC17), on the real api. Development is shared, so the
// tests check only the categories of this run, their order and which of them show (Testing Strategy, plan Architecture
// Decisions 13). They create their data through the admin API and delete it when done (TW3).
test.describe.configure({ mode: 'default' });

/** A new category reaches the page within 60 s at most (NFR6). */
const CACHE_WAIT = { timeout: 60_000 };

const COPY = { vi: { label: 'Danh mục' }, en: { label: 'Categories' } } as const;

let api: APIRequestContext;
let gloves: CreatedCategory;
let jackets: CreatedCategory;
let accessories: CreatedCategory;
let dresses: CreatedCategory;
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
    products.push(await createProduct(api, runId, input));
  };

  // "Bao tay" first, so an order by creation would put it first: the page must order by name, A→Z in Vietnamese.
  gloves = await category({ name: 'Bao tay' });
  jackets = await category({ name: 'Áo khoác' });
  accessories = await category({ name: 'Phụ kiện', status: 'HIDDEN' });
  dresses = await category({ name: 'Đầm' });
  await product({ name: 'Bao tay len', price: 90000, categoryId: gloves.id });
  await product({ name: 'Áo khoác gió', price: 500000, categoryId: jackets.id });
  await product({ name: 'Khăn lụa', price: 150000, categoryId: accessories.id });
  await product({ name: 'Đầm hoa', price: 400000, status: 'HIDDEN', categoryId: dresses.id });
});

test.afterAll(async () => {
  for (const product of products) await deleteProduct(api, product.id);
  for (const category of categories) await deleteCategory(api, category.id);
  await api.dispose();
});

const row = (page: Page, locale: 'vi' | 'en') =>
  page.getByRole('main').getByRole('navigation', { name: COPY[locale].label });

/** The names of the links of this run, in the order of the row. */
async function linksOfThisRun(page: Page, locale: 'vi' | 'en'): Promise<string[]> {
  const names = await row(page, locale).getByRole('link').allTextContents();
  return names.filter((name) => name.endsWith(` E2E ${runId}`));
}

/** Opens the products page until the row shows the categories of this run that have a product on sale (NFR6). */
async function openProducts(page: Page, locale: 'vi' | 'en') {
  await expect(async () => {
    await page.goto(`/${locale}/products`);
    expect(await linksOfThisRun(page, locale)).toHaveLength(2);
  }).toPass(CACHE_WAIT);
}

for (const locale of ['vi', 'en'] as const) {
  test(`AC17 shows "Áo khoác" then "Bao tay", and neither "Phụ kiện" nor "Đầm", in ${locale}`, async ({
    page,
  }) => {
    await openProducts(page, locale);

    expect(await linksOfThisRun(page, locale)).toEqual([jackets.name, gloves.name]);
    const names = await row(page, locale).getByRole('link').allTextContents();
    expect(names).not.toContain(accessories.name);
    expect(names).not.toContain(dresses.name);
    // The visible label of the row (S7.3).
    await expect(row(page, locale)).toContainText(COPY[locale].label);
  });

  test(`AC17 opens the page of "Áo khoác" in ${locale}`, async ({ page }) => {
    await openProducts(page, locale);

    await row(page, locale).getByRole('link', { name: jackets.name }).click();

    await expect(page).toHaveURL(new RegExp(`/${locale}/categories/${jackets.slug}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(jackets.name);
  });
}

test('AC17 puts each link as a real <a href> in the HTML of the response, with no count of products', async ({
  page,
}) => {
  await openProducts(page, 'vi');

  const html = await (await page.request.get('/vi/products')).text();

  expect(html).toContain(`href="/vi/categories/${jackets.slug}"`);
  expect(html).toContain(`href="/vi/categories/${gloves.slug}"`);
  expect(html).not.toContain(`/vi/categories/${accessories.slug}"`);
  expect(html).not.toContain(`/vi/categories/${dresses.slug}"`);
  await expect(row(page, 'vi').getByRole('link', { name: jackets.name })).toHaveText(jackets.name);
});

for (const locale of ['vi', 'en'] as const) {
  test(`S7 has no horizontal scroll bar at 320 px in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await openProducts(page, locale);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    expect(overflow).toBe(0);
  });
}
