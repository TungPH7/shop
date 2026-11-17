import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

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

// The run id of this file only, in the names (so the slugs) of its products: see newRunId.
const runId = newRunId();

// S5, the product detail page of the store (SHOP-21: AC24, AC25), on the real api: each test reads products this file
// creates through the admin API and deletes when done (NFR23). The tests of a file share those products, so they run
// in order in one worker.
test.describe.configure({ mode: 'default' });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const COPY = {
  vi: { inStock: 'Còn hàng', description: 'Mô tả', back: 'Sản phẩm' },
  en: { inStock: 'In stock', description: 'Description', back: 'Products' },
} as const;

let api: APIRequestContext;
let shirt: CreatedProduct;
let jeans: CreatedProduct;
let htmlDescribed: CreatedProduct;
/** What beforeAll created, deleted in afterAll even when beforeAll stops half-way. */
const created: CreatedProduct[] = [];

const TWO_LINES = 'Áo thun cotton 100%.\nCổ tròn, tay ngắn.';
const HTML_DESCRIPTION = '<b>Mới</b><script>alert(1)</script>';

test.beforeAll(async ({}, testInfo) => {
  api = await adminApi(adminUrlFor(testInfo.project.use.baseURL));
  await deleteStaleProducts(api);
  const create = async (input: ProductInput) => {
    const product = await createProduct(api, runId, input);
    created.push(product);
    return product;
  };
  shirt = await create({
    name: 'Áo thun cổ tròn',
    price: 200000,
    compareAtPrice: 250000,
    description: TWO_LINES,
  });
  jeans = await create({ name: 'Quần jean nam', price: 450000 });
  htmlDescribed = await create({ name: 'Áo khoác', price: 300000, description: HTML_DESCRIPTION });
});

test.afterAll(async () => {
  for (const product of created) await deleteProduct(api, product.id);
  await api.dispose();
});

const description = (page: Page) => page.locator('main p.product-detail__description');

for (const locale of ['vi', 'en'] as const) {
  test(`AC24 shows the placeholder, name, prices, discount, stock and two-line description in ${locale}`, async ({
    page,
  }) => {
    await page.goto(`/${locale}/products/${shirt.slug}`);
    const main = page.getByRole('main');

    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(main.getByRole('heading', { level: 1, name: shirt.name })).toBeVisible();
    const tile = main.locator('[data-variant="detail"]');
    await expect(tile).toBeVisible();
    await expect(tile).toHaveAttribute('aria-hidden', 'true');
    await expect(tile).toHaveText('Á');
    await expect(main.getByText(/^200\.000\s₫$/)).toBeVisible();
    await expect(main.locator('s')).toHaveText(/^250\.000\s₫$/);
    await expect(main.getByText('-20%', { exact: true })).toBeVisible();
    await expect(main.getByText(COPY[locale].inStock, { exact: true })).toBeVisible();
    await expect(
      main.getByRole('heading', { level: 2, name: COPY[locale].description }),
    ).toBeVisible();

    // innerText follows the rendering: with white-space: pre-line the line break stays, and the paragraph is two lines.
    const paragraph = description(page);
    expect(await paragraph.innerText()).toBe(TWO_LINES);
    const lines = await paragraph.evaluate((element) => {
      const style = getComputedStyle(element);
      return Math.round(
        element.getBoundingClientRect().height / Number.parseFloat(style.lineHeight),
      );
    });
    expect(lines).toBe(2);
  });
}

test('AC24 shows only the price when there is no original price', async ({ page }) => {
  await page.goto(`/vi/products/${jeans.slug}`);
  const main = page.getByRole('main');

  await expect(main.getByRole('heading', { level: 1, name: jeans.name })).toBeVisible();
  await expect(main.getByText(/^450\.000\s₫$/)).toBeVisible();
  await expect(main.locator('s')).toHaveCount(0);
  await expect(main.getByText(/^-\d+%$/)).toHaveCount(0);
  // No description: no heading Mô tả either.
  await expect(main.getByRole('heading', { level: 2 })).toHaveCount(0);
});

test('AC25 shows an HTML description as text, with no bold word and no script run', async ({
  page,
}) => {
  const dialogs: string[] = [];
  page.on('dialog', async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });

  await page.goto(`/vi/products/${htmlDescribed.slug}`);

  await expect(description(page)).toHaveText(HTML_DESCRIPTION);
  await expect(description(page).locator('*')).toHaveCount(0);
  await expect(page.getByRole('main').locator('b, strong')).toHaveCount(0);
  expect(dialogs).toEqual([]);
});

test('the back link opens the products page S4', async ({ page }) => {
  await page.goto(`/en/products/${shirt.slug}`);

  await page.getByRole('main').getByRole('link', { name: COPY.en.back }).click();

  await expect(page).toHaveURL(/\/en\/products$/);
});

for (const locale of ['vi', 'en'] as const) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`S5 has no axe violation in ${locale}, ${colorScheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto(`/${locale}/products/${shirt.slug}`);
      await expect(page.getByRole('heading', { level: 1, name: shirt.name })).toBeVisible();
      const theme = expect(page.locator('html'));
      await (colorScheme === 'dark' ? theme : theme.not).toHaveClass(/\bdark\b/);

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      expect(violations).toEqual([]);
    });
  }
}
