import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import {
  adminApi,
  createProduct,
  deleteProduct,
  deleteStaleProducts,
  runId,
  type CreatedProduct,
} from './support/products';

// S6, the product not found page of the store (SHOP-24: AC26), on the real api: a page load of the product detail page
// answers HTTP 404 with S6, the same for a slug that never existed, a hidden product and a deleted one (NFR9). The tests
// create their products through the admin API and delete them when done (NFR23); they share them, so they run in order
// in one worker.
test.describe.configure({ mode: 'default' });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const COPY = {
  vi: {
    title: 'Không tìm thấy sản phẩm',
    line: 'Sản phẩm này không tồn tại hoặc không còn được bán.',
    viewAll: 'Xem tất cả sản phẩm',
    products: 'Sản phẩm',
  },
  en: {
    title: 'Product not found',
    line: "This product doesn't exist or is no longer available.",
    viewAll: 'View all products',
    products: 'Products',
  },
} as const;

let api: APIRequestContext;
let onSale: CreatedProduct;
let hidden: CreatedProduct;
let deleted: CreatedProduct;
/** What beforeAll created, deleted in afterAll even when beforeAll stops half-way. */
const created: CreatedProduct[] = [];

/** A slug no product ever had: the run id keeps it apart from every product of other runs. */
const neverExisted = `khong-co-san-pham-${runId}`;

test.beforeAll(async () => {
  api = await adminApi();
  await deleteStaleProducts(api);
  onSale = await createProduct(api, { name: 'Mũ lưỡi trai', price: 150000 });
  created.push(onSale);
  hidden = await createProduct(api, { name: 'Khăn quàng', price: 120000, status: 'HIDDEN' });
  created.push(hidden);
  deleted = await createProduct(api, { name: 'Găng tay len', price: 90000 });
  await deleteProduct(api, deleted.id);
});

test.afterAll(async () => {
  for (const product of created) await deleteProduct(api, product.id);
  await api.dispose();
});

/** Expects S6 in `locale`: its only h1, its line and its link to S4, under the bar with Products current. */
async function expectS6(page: Page, locale: 'vi' | 'en') {
  const main = page.getByRole('main');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(main.getByRole('heading', { level: 1, name: COPY[locale].title })).toBeVisible();
  await expect(main.getByText(COPY[locale].line, { exact: true })).toBeVisible();
  await expect(main.getByRole('link', { name: COPY[locale].viewAll })).toHaveAttribute(
    'href',
    `/${locale}/products`,
  );
  await expect(
    page.getByRole('navigation').getByRole('link', { name: COPY[locale].products }),
  ).toHaveAttribute('aria-current', 'page');
}

const cases = [
  ['a slug that never existed', () => neverExisted],
  ['a hidden product', () => hidden.slug],
  ['a deleted product', () => deleted.slug],
] as const;

for (const [what, slugOf] of cases) {
  for (const locale of ['vi', 'en'] as const) {
    test(`AC26 answers 404 with S6 for ${what} in ${locale}`, async ({ page }) => {
      const response = await page.goto(`/${locale}/products/${slugOf()}`);

      expect(response?.status()).toBe(404);
      await expectS6(page, locale);
      // The address stays the one the customer opened: the Proxy rewrites, it does not redirect.
      expect(new URL(page.url()).pathname).toBe(`/${locale}/products/${slugOf()}`);
    });
  }
}

test('AC26 answers 404 with S6 for a product link pasted with the full stop of a sentence', async ({
  page,
}) => {
  // A path with a dot passed by the Proxy, as an asset does, and showed S6 with 200 (review of PR #51, SHOP-58).
  const response = await page.goto(`/vi/products/${onSale.slug}.`);

  expect(response?.status()).toBe(404);
  await expectS6(page, 'vi');
});

test('AC26 the link of S6 opens the products page S4 with no parameter', async ({ page }) => {
  await page.goto(`/vi/products/${neverExisted}`);

  await page.getByRole('main').getByRole('link', { name: COPY.vi.viewAll }).click();

  await expect(page).toHaveURL(/\/vi\/products$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Sản phẩm' })).toBeVisible();
});

test('a product on sale still answers 200 with S5', async ({ page }) => {
  const response = await page.goto(`/vi/products/${onSale.slug}`);

  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: onSale.name })).toBeVisible();
});

for (const locale of ['vi', 'en'] as const) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`S6 has no axe violation in ${locale}, ${colorScheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(`/${locale}/products/${neverExisted}`);
      await expect(page.getByRole('heading', { level: 1, name: COPY[locale].title })).toBeVisible();
      const theme = expect(page.locator('html'));
      await (colorScheme === 'dark' ? theme : theme.not).toHaveClass(/\bdark\b/);

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      expect(violations).toEqual([]);
    });
  }
}
