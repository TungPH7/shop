import AxeBuilder from '@axe-core/playwright';
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

// S5 and S6 of SHOP-81, the category page of the store and its not found page (AC12–AC16), on the real api. The tests
// create their categories and products through the admin API and delete them when done (TW3); they share them, so they
// run in order in one worker.
test.describe.configure({ mode: 'default' });

/** A new category or product reaches the page within 60 s at most (NFR6). */
const CACHE_WAIT = { timeout: 60_000 };

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

type Locale = 'vi' | 'en';

const COPY = {
  vi: {
    list: 'Danh sách sản phẩm',
    sort: 'Sắp xếp',
    loadMore: 'Xem thêm',
    empty: 'Chưa có sản phẩm nào trong danh mục này.',
    viewAll: 'Xem tất cả sản phẩm',
    notFound: 'Không tìm thấy danh mục',
    notFoundLine: 'Danh mục này không tồn tại hoặc không còn được hiển thị.',
    products: 'Sản phẩm',
  },
  en: {
    list: 'Product list',
    sort: 'Sort by',
    loadMore: 'Load more',
    empty: 'No products in this category yet.',
    viewAll: 'View all products',
    notFound: 'Category not found',
    notFoundLine: "This category doesn't exist or is no longer available.",
    products: 'Products',
  },
} as const;

let api: APIRequestContext;
let ao: CreatedCategory;
let quan: CreatedCategory;
let prices: CreatedCategory;
let many: CreatedCategory;
let accessories: CreatedCategory;
let hidden: CreatedCategory;
let deleted: CreatedCategory;
/** What beforeAll created, deleted in afterAll even when beforeAll stops half-way: products first, then categories. */
const products: CreatedProduct[] = [];
const categories: CreatedCategory[] = [];
const byName = new Map<string, CreatedProduct>();

/** A slug no category ever had: the run id keeps it apart from every category of other runs. */
const neverExisted = `khong-co-danh-muc-${runId}`;

test.beforeAll(async ({}, testInfo) => {
  test.setTimeout(180_000);
  api = await adminApi(adminUrlFor(testInfo.project.use.baseURL));
  await deleteStaleProducts(api);
  await deleteStaleCategories(api);
  const category = async (input: CategoryInput) => {
    const created = await createCategory(api, runId, input);
    categories.push(created);
    return created;
  };
  // One after the other, so each product is newer than the one before it.
  const product = async (input: ProductInput) => {
    const created = await createProduct(api, runId, input);
    products.push(created);
    byName.set(input.name, created);
    return created;
  };

  ao = await category({ name: 'Áo' });
  quan = await category({ name: 'Quần' });
  prices = await category({ name: 'Giá' });
  many = await category({ name: 'Nhiều' });
  accessories = await category({ name: 'Phụ kiện' });
  hidden = await category({ name: 'Ẩn', status: 'HIDDEN' });
  deleted = await category({ name: 'Đã xóa' });

  // AC12: "Áo len" first, so "Áo thun cổ tròn" is the newest.
  await product({ name: 'Áo len', price: 300000, categoryId: ao.id });
  await product({ name: 'Áo thun cổ tròn', price: 200000, categoryId: ao.id });
  await product({ name: 'Áo lụa', price: 250000, status: 'HIDDEN', categoryId: ao.id });
  await product({ name: 'Quần jean nam', price: 450000, categoryId: quan.id });
  // AC13: "Giá D" and "Giá C" share a price, and D is the newer.
  await product({ name: 'Giá A', price: 300000, categoryId: prices.id });
  await product({ name: 'Giá B', price: 100000, categoryId: prices.id });
  await product({ name: 'Giá C', price: 200000, categoryId: prices.id });
  await product({ name: 'Giá D', price: 200000, categoryId: prices.id });
  // AC14: 30 products on sale.
  for (let i = 1; i <= 30; i += 1) {
    await product({
      name: `Nhiều ${String(i).padStart(2, '0')}`,
      price: 100000 + i * 1000,
      categoryId: many.id,
    });
  }
  // AC16: a hidden category with a product on sale, and a deleted one.
  await product({ name: 'Khăn ẩn', price: 90000, categoryId: hidden.id });
  await deleteCategory(api, deleted.id);
});

test.afterAll(async () => {
  for (const product of products) await deleteProduct(api, product.id);
  for (const category of categories) await deleteCategory(api, category.id);
  await api.dispose();
});

const grid = (page: Page, locale: Locale = 'vi') =>
  page.getByRole('main').getByRole('list', { name: COPY[locale].list });
const cards = (page: Page, locale: Locale = 'vi') => grid(page, locale).getByRole('listitem');
const sortSelect = (page: Page, locale: Locale = 'vi') =>
  page.getByRole('main').getByRole('combobox', { name: COPY[locale].sort });
const loadMore = (page: Page, locale: Locale = 'vi') =>
  page.getByRole('main').getByRole('button', { name: COPY[locale].loadMore });

/** The names on the cards, in the order of the grid, without the label of the run. */
async function cardNames(page: Page): Promise<string[]> {
  const label = ` E2E ${runId}`;
  const names = await page.locator('main .product-card__name').allTextContents();
  return names.map((name) => (name.endsWith(label) ? name.slice(0, -label.length) : name));
}

/** Opens the page of `category` until it shows `count` cards: a new product reaches it within 60 s (NFR6). */
async function openCategory(
  page: Page,
  category: CreatedCategory,
  { locale = 'vi', count, query = '' }: { locale?: Locale; count: number; query?: string },
) {
  await expect(async () => {
    await page.goto(`/${locale}/categories/${category.slug}${query}`);
    await expect(cards(page, locale)).toHaveCount(count, { timeout: 2_000 });
  }).toPass(CACHE_WAIT);
}

/** Picks `label` in the sort and waits for the URL to name `sort`. */
async function sortBy(page: Page, label: string, sort: string | null) {
  await expect(async () => {
    await sortSelect(page).selectOption({ label });
    await expect(page).toHaveURL((url) => url.searchParams.get('sort') === sort, {
      timeout: 2_000,
    });
  }).toPass();
}

for (const locale of ['vi', 'en'] as const) {
  test(`AC12 shows the name of the category as the h1 and only its products on sale, the newest first, in ${locale}`, async ({
    page,
  }) => {
    await openCategory(page, ao, { locale, count: 2 });

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(ao.name);
    expect(await cardNames(page)).toEqual(['Áo thun cổ tròn', 'Áo len']);
    // The navigation bar keeps Products current: a category is a part of the store of products (S5.1).
    await expect(
      page.getByRole('navigation').getByRole('link', { name: COPY[locale].products }),
    ).toHaveAttribute('aria-current', 'page');
  });
}

test('AC12 opens the product detail page of a card', async ({ page }) => {
  await openCategory(page, ao, { count: 2 });
  const shirt = byName.get('Áo thun cổ tròn');
  if (!shirt) throw new Error('no shirt');

  await cards(page).first().getByRole('link').click();

  await expect(page).toHaveURL(new RegExp(`/vi/products/${shirt.slug}$`));
  await expect(page.getByRole('heading', { level: 1, name: shirt.name })).toBeVisible();
});

test('AC13 sorts by price both ways, the newer first on a tie, and by newest, with no search and no relevance', async ({
  page,
}) => {
  await openCategory(page, prices, { count: 4 });

  await expect(page.getByRole('main').getByRole('searchbox')).toHaveCount(0);
  await expect(page.getByRole('main').getByRole('search')).toHaveCount(0);
  await expect(sortSelect(page).getByRole('option')).toHaveText([
    'Mới nhất',
    'Giá thấp đến cao',
    'Giá cao đến thấp',
  ]);
  expect(await cardNames(page)).toEqual(['Giá D', 'Giá C', 'Giá B', 'Giá A']);

  await sortBy(page, 'Giá thấp đến cao', 'price-asc');
  await expect.poll(() => cardNames(page)).toEqual(['Giá B', 'Giá D', 'Giá C', 'Giá A']);

  await sortBy(page, 'Giá cao đến thấp', 'price-desc');
  await expect.poll(() => cardNames(page)).toEqual(['Giá A', 'Giá D', 'Giá C', 'Giá B']);

  await sortBy(page, 'Mới nhất', null);
  await expect.poll(() => cardNames(page)).toEqual(['Giá D', 'Giá C', 'Giá B', 'Giá A']);
});

test('AC14 shows 24 products, "Đã xem 24 trên 30 sản phẩm" and Xem thêm, then the 6 others below', async ({
  page,
}) => {
  await openCategory(page, many, { count: 24 });
  const progress = page.getByRole('main').getByRole('status');
  await expect(progress).toHaveText('Đã xem 24 trên 30 sản phẩm');
  const first = await cardNames(page);

  await loadMore(page).click();

  await expect(cards(page)).toHaveCount(30);
  expect((await cardNames(page)).slice(0, 24)).toEqual(first);
  await expect(progress).toHaveText('Đã xem 30 trên 30 sản phẩm');
  await expect(loadMore(page)).toHaveCount(0);
  await expect(page).toHaveURL((url) => url.searchParams.get('page') === '2');
});

test('AC14 keeps the sort and the products shown on a reload and in another tab', async ({
  page,
  context,
}) => {
  await openCategory(page, many, { count: 24 });
  await sortBy(page, 'Giá thấp đến cao', 'price-asc');
  await expect.poll(async () => (await cardNames(page))[0]).toBe('Nhiều 01');
  await loadMore(page).click();
  await expect(cards(page)).toHaveCount(30);
  await expect(page).toHaveURL(
    (url) => url.searchParams.get('sort') === 'price-asc' && url.searchParams.get('page') === '2',
  );
  const shown = await cardNames(page);

  await page.reload();
  await expect(cards(page)).toHaveCount(30);
  expect(await cardNames(page)).toEqual(shown);
  await expect(sortSelect(page)).toHaveValue('price-asc');

  const other = await context.newPage();
  await other.goto(page.url());
  await expect(cards(other)).toHaveCount(30);
  expect(await cardNames(other)).toEqual(shown);
  await other.close();
});

test('AC14 reads a wrong value of the URL as its default instead of an error', async ({ page }) => {
  const response = await page.goto(`/vi/categories/${many.slug}?sort=relevance&page=abc`);

  expect(response?.status()).toBe(200);
  await expect(cards(page)).toHaveCount(24);
  await expect(sortSelect(page)).toHaveValue('newest');
  await expect(page.getByRole('main').getByRole('status')).toHaveText('Đã xem 24 trên 30 sản phẩm');
});

for (const locale of ['vi', 'en'] as const) {
  test(`AC15 shows the h1, "no products yet" and a link to every product for a visible category with none, with 200, in ${locale}`, async ({
    page,
  }) => {
    const response = await page.goto(`/${locale}/categories/${accessories.slug}`);

    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(accessories.name);
    const main = page.getByRole('main');
    await expect(main.getByRole('status')).toHaveText(COPY[locale].empty);
    await expect(main.getByRole('link', { name: COPY[locale].viewAll })).toHaveAttribute(
      'href',
      `/${locale}/products`,
    );
    await expect(sortSelect(page, locale)).toHaveCount(0);
  });
}

/** Expects S6 in `locale`: its only h1, its line and its link to the products page, with no breadcrumb. */
async function expectS6(page: Page, locale: Locale) {
  const main = page.getByRole('main');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(main.getByRole('heading', { level: 1, name: COPY[locale].notFound })).toBeVisible();
  await expect(main.getByText(COPY[locale].notFoundLine, { exact: true })).toBeVisible();
  await expect(main.getByRole('link', { name: COPY[locale].viewAll })).toHaveAttribute(
    'href',
    `/${locale}/products`,
  );
  await expect(main.getByRole('navigation')).toHaveCount(0);
}

const notFoundCases = [
  ['a slug that never existed', () => neverExisted],
  ['a hidden category', () => hidden.slug],
  ['a deleted category', () => deleted.slug],
] as const;

for (const [what, slugOf] of notFoundCases) {
  for (const locale of ['vi', 'en'] as const) {
    test(`AC16 answers 404 with S6 for ${what} in ${locale}`, async ({ page }) => {
      const response = await page.goto(`/${locale}/categories/${slugOf()}`);

      expect(response?.status()).toBe(404);
      await expectS6(page, locale);
      // The address stays the one the customer opened: the Proxy rewrites, it does not redirect.
      expect(new URL(page.url()).pathname).toBe(`/${locale}/categories/${slugOf()}`);
    });
  }
}

test('AC16 gives the same page for the three cases, so no one learns a hidden category exists', async ({
  page,
}) => {
  const texts: string[] = [];
  for (const [, slugOf] of notFoundCases) {
    await page.goto(`/vi/categories/${slugOf()}`);
    await expectS6(page, 'vi');
    texts.push((await page.getByRole('main').innerText()).trim());
  }

  expect(new Set(texts).size).toBe(1);
  expect(texts[0]).not.toContain(hidden.name);
});

test('AC16 the link of S6 opens the products page with no parameter', async ({ page }) => {
  await page.goto(`/vi/categories/${neverExisted}`);

  await page.getByRole('main').getByRole('link', { name: COPY.vi.viewAll }).click();

  await expect(page).toHaveURL(/\/vi\/products$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sản phẩm' })).toBeVisible();
});

for (const locale of ['vi', 'en'] as const) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`S5 has no axe violation in ${locale}, ${colorScheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await openCategory(page, ao, { locale, count: 2 });
      const theme = expect(page.locator('html'));
      await (colorScheme === 'dark' ? theme : theme.not).toHaveClass(/\bdark\b/);

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      expect(violations).toEqual([]);
    });

    test(`S6 has no axe violation in ${locale}, ${colorScheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(`/${locale}/categories/${neverExisted}`);
      await expectS6(page, locale);
      const theme = expect(page.locator('html'));
      await (colorScheme === 'dark' ? theme : theme.not).toHaveClass(/\bdark\b/);

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      expect(violations).toEqual([]);
    });
  }
}

for (const locale of ['vi', 'en'] as const) {
  test(`S5 has no horizontal scroll bar at 320 px in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await openCategory(page, many, { locale, count: 24 });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    expect(overflow).toBe(0);
  });
}
