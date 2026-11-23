import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import {
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
  type CreatedProduct,
} from './support/products';

// The display order of categories (docs/specs/SHOP-95/spec.md; Story SHOP-96) in the row of category links of the
// products page (S7.4 of SHOP-81), on the real api: AC7 and the store part of AC8. Each test creates its categories, each
// visible with a product on sale, through the admin API, and deletes them when done (TW3). Development is shared, so a
// test only compares the links of this run, named `… E2E <runId>` (plan, Architecture Decisions 10). E2E of SHOP-81 have
// names starting with the same codes: run one criterion of this file with the file, as in
// `e2e/category-order.spec.ts -g "AC7"`.
// Each test waits up to 60 s for its links to show, and the AC7 test that moves "Áo" 60 s more for the new order.
test.describe.configure({ mode: 'default', timeout: 180_000 });

/**
 * A run id per test: the page may still hold the list of an earlier test of this file for up to 60 s, and categories of
 * another test with the same names must not count as this test's.
 */
let runId = newRunId();

/** A change of the categories reaches the page within 60 s at most (NFR5 of SHOP-95, NFR6 of SHOP-81). */
const WITHIN_60_S = { timeout: 60_000, intervals: [1_000, 2_000, 5_000] };

const LABEL = { vi: 'Danh mục', en: 'Categories' } as const;

let api: APIRequestContext;
let categories: CreatedCategory[] = [];
let products: CreatedProduct[] = [];

test.beforeAll(async ({}, testInfo) => {
  api = await adminApi(adminUrlFor(testInfo.project.use.baseURL));
  await deleteStaleProducts(api);
  await deleteStaleCategories(api);
});

test.beforeEach(() => {
  runId = newRunId();
});

test.afterEach(async () => {
  for (const product of products) await deleteProduct(api, product.id);
  for (const category of categories) await deleteCategory(api, category.id);
  products = [];
  categories = [];
});

test.afterAll(async () => {
  await api.dispose();
});

/** A visible category of this run with one product on sale, so it shows in the row. */
async function categoryOnSale(input: CategoryInput): Promise<CreatedCategory> {
  const category = await createCategory(api, runId, input);
  categories.push(category);
  products.push(
    await createProduct(api, runId, {
      name: `SP ${input.name}`,
      price: 100000,
      categoryId: category.id,
    }),
  );
  return category;
}

/** "Áo" 2, "Bao tay" 1, "Đầm" 1 and "Quần" 0 (AC7), added in neither the order of names nor of numbers. */
async function theFourCategoriesOfAc7() {
  const dresses = await categoryOnSale({ name: 'Đầm', displayOrder: 1 });
  const shirts = await categoryOnSale({ name: 'Áo', displayOrder: 2 });
  const trousers = await categoryOnSale({ name: 'Quần', displayOrder: 0 });
  const gloves = await categoryOnSale({ name: 'Bao tay', displayOrder: 1 });
  return { dresses, shirts, trousers, gloves };
}

/** The names of the links of this run, in the order of the row. */
async function linksOfThisRun(page: Page, locale: 'vi' | 'en'): Promise<string[]> {
  // The row streams in after the load of the page (a dynamic hole in a <Suspense>): wait for it, or it reads as empty.
  const row = page.getByRole('main').getByRole('navigation', { name: LABEL[locale] });
  await expect(row).toBeVisible();
  const names = await row.getByRole('link').allTextContents();
  return names.filter((name) => name.endsWith(` E2E ${runId}`));
}

/** The links of this run once the page shows all `count` of them (NFR5), read on a fresh load each time. */
async function linksOnceAllShow(page: Page, locale: 'vi' | 'en', count: number): Promise<string[]> {
  let links: string[] = [];
  await expect(async () => {
    await page.goto(`/${locale}/products`);
    links = await linksOfThisRun(page, locale);
    expect(links).toHaveLength(count);
  }).toPass(WITHIN_60_S);
  return links;
}

for (const locale of ['vi', 'en'] as const) {
  test(`AC7 lists "Quần", "Bao tay", "Đầm", "Áo" by display order, then name, in ${locale}`, async ({
    page,
  }) => {
    const { dresses, shirts, trousers, gloves } = await theFourCategoriesOfAc7();

    expect(await linksOnceAllShow(page, locale, 4)).toEqual([
      trousers.name,
      gloves.name,
      dresses.name,
      shirts.name,
    ]);
  });
}

test('AC7 puts "Áo" first within 60 seconds once its display order is 0', async ({ page }) => {
  const { dresses, shirts, trousers, gloves } = await theFourCategoriesOfAc7();
  expect(await linksOnceAllShow(page, 'vi', 4)).toEqual([
    trousers.name,
    gloves.name,
    dresses.name,
    shirts.name,
  ]);

  const moved = await updateCategory(api, shirts, { displayOrder: 0 });
  expect(moved.displayOrder).toBe(0);

  await expect
    .poll(async () => {
      await page.goto('/vi/products');
      return linksOfThisRun(page, 'vi');
    }, WITHIN_60_S)
    .toEqual([shirts.name, trousers.name, gloves.name, dresses.name]);
});

test('AC8 lists three categories added without a display order by name: "Áo khoác", "Bao tay", "Quần"', async ({
  page,
}) => {
  // Added in the reverse order of their names, none with a display order.
  const trousers = await categoryOnSale({ name: 'Quần' });
  const gloves = await categoryOnSale({ name: 'Bao tay' });
  const jackets = await categoryOnSale({ name: 'Áo khoác' });
  expect([trousers, gloves, jackets].map(({ displayOrder }) => displayOrder)).toEqual([0, 0, 0]);

  expect(await linksOnceAllShow(page, 'vi', 3)).toEqual([jackets.name, gloves.name, trousers.name]);
});
