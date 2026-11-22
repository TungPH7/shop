import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import {
  createCategory,
  deleteCategory,
  deleteStaleCategories,
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

// The run id of this file only, in the names (so the slugs) of its categories and products: see newRunId.
const runId = newRunId();

// S8 of SHOP-81, the breadcrumb of the product detail page and its BreadcrumbList (AC20, AC21), on the real api. The
// tests create their data through the admin API and delete it when done (TW3); they share it, so they run in order.
test.describe.configure({ mode: 'default' });

/** A change reaches the page within 60 s at most (NFR6). */
const CACHE_WAIT = { timeout: 60_000 };

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

type Locale = 'vi' | 'en';

const COPY = {
  vi: { home: 'Trang chủ', label: 'Đường dẫn trang', back: 'Sản phẩm' },
  en: { home: 'Home', label: 'Breadcrumb', back: 'Products' },
} as const;

let api: APIRequestContext;
let ao: CreatedCategory;
let accessories: CreatedCategory;
let shirt: CreatedProduct;
let jeans: CreatedProduct;
let scarf: CreatedProduct;
const products: CreatedProduct[] = [];
const categories: CreatedCategory[] = [];

test.beforeAll(async ({}, testInfo) => {
  api = await adminApi(adminUrlFor(testInfo.project.use.baseURL));
  await deleteStaleProducts(api);
  await deleteStaleCategories(api);
  ao = await createCategory(api, runId, { name: 'Áo' });
  categories.push(ao);
  accessories = await createCategory(api, runId, { name: 'Phụ kiện', status: 'HIDDEN' });
  categories.push(accessories);
  shirt = await createProduct(api, runId, {
    name: 'Áo thun cổ tròn',
    price: 200000,
    categoryId: ao.id,
  });
  products.push(shirt);
  jeans = await createProduct(api, runId, { name: 'Quần jean nam', price: 450000 });
  products.push(jeans);
  scarf = await createProduct(api, runId, {
    name: 'Khăn lụa',
    price: 150000,
    categoryId: accessories.id,
  });
  products.push(scarf);
});

test.afterAll(async () => {
  for (const product of products) await deleteProduct(api, product.id);
  for (const category of categories) await deleteCategory(api, category.id);
  await api.dispose();
});

const trailOf = (page: Page, locale: Locale) =>
  page.getByRole('navigation', { name: COPY[locale].label });

/** Opens S8 of `product` until its breadcrumb has `count` crumbs: a change reaches the page within 60 s (NFR6). */
async function openProduct(page: Page, locale: Locale, product: CreatedProduct, count: number) {
  await expect(async () => {
    await page.goto(`/${locale}/products/${product.slug}`);
    await expect(trailOf(page, locale).getByRole('listitem')).toHaveCount(count, {
      timeout: 2_000,
    });
  }).toPass(CACHE_WAIT);
}

type Ld = { '@type': string; itemListElement?: { position: number; name: string; item: string }[] };

async function jsonLdOf(page: Page): Promise<Ld[]> {
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  return blocks.map((text) => JSON.parse(text) as Ld);
}

const pathOf = (url: string) => new URL(url).pathname;

for (const locale of ['vi', 'en'] as const) {
  test(`AC20 shows ${COPY[locale].home} › Áo › Áo thun cổ tròn, the first two links, in ${locale}`, async ({
    page,
  }) => {
    await openProduct(page, locale, shirt, 3);
    const trail = trailOf(page, locale);

    await expect(trail.getByRole('listitem')).toHaveText([
      `${COPY[locale].home}›`,
      `${ao.name}›`,
      shirt.name,
    ]);
    await expect(trail.getByRole('link', { name: COPY[locale].home })).toHaveAttribute(
      'href',
      `/${locale}`,
    );
    await expect(trail.getByRole('link', { name: ao.name })).toHaveAttribute(
      'href',
      `/${locale}/categories/${ao.slug}`,
    );
    await expect(trail.getByRole('link')).toHaveCount(2);
    await expect(trail.getByText(shirt.name)).toHaveAttribute('aria-current', 'page');
    // The back link of S8.3 stays, under the breadcrumb.
    await expect(
      page.getByRole('main').getByRole('link', { name: COPY[locale].back }),
    ).toBeVisible();
  });

  test(`AC20 gives one BreadcrumbList of the three crumbs with absolute URLs of ${locale}, and keeps one Product`, async ({
    page,
  }) => {
    await openProduct(page, locale, shirt, 3);

    const lds = await jsonLdOf(page);
    const breadcrumbs = lds.filter((ld) => ld['@type'] === 'BreadcrumbList');
    expect(breadcrumbs).toHaveLength(1);
    const items = breadcrumbs[0]?.itemListElement ?? [];
    expect(items.map(({ position, name }) => [position, name])).toEqual([
      [1, COPY[locale].home],
      [2, ao.name],
      [3, shirt.name],
    ]);
    expect(items.map(({ item }) => pathOf(item))).toEqual([
      `/${locale}`,
      `/${locale}/categories/${ao.slug}`,
      `/${locale}/products/${shirt.slug}`,
    ]);
    expect(lds.filter((ld) => ld['@type'] === 'Product')).toHaveLength(1);
  });

  test(`AC20 the category of the breadcrumb opens its page in ${locale}`, async ({ page }) => {
    await openProduct(page, locale, shirt, 3);

    await trailOf(page, locale).getByRole('link', { name: ao.name }).click();

    await expect(page).toHaveURL(new RegExp(`/${locale}/categories/${ao.slug}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(ao.name);
  });
}

for (const [what, productOf] of [
  ['a product with no category', () => jeans],
  ['a product of a hidden category', () => scarf],
] as const) {
  test(`AC21 shows Trang chủ › ‹name› and two crumbs of JSON-LD for ${what}, and never names the hidden category`, async ({
    page,
  }) => {
    const product = productOf();
    await openProduct(page, 'vi', product, 2);

    await expect(trailOf(page, 'vi').getByRole('listitem')).toHaveText([
      'Trang chủ›',
      product.name,
    ]);
    const breadcrumb = (await jsonLdOf(page)).find((ld) => ld['@type'] === 'BreadcrumbList');
    expect(breadcrumb?.itemListElement?.map(({ name }) => name)).toEqual([
      'Trang chủ',
      product.name,
    ]);
    // Nowhere on the page, not even in the raw HTML (NFR8).
    const html = await (await page.request.get(`/vi/products/${product.slug}`)).text();
    expect(html).not.toContain(accessories.name);
    expect(html).not.toContain(accessories.slug);
  });
}

for (const locale of ['vi', 'en'] as const) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`S8 has no axe violation in ${locale}, ${colorScheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await openProduct(page, locale, shirt, 3);
      const theme = expect(page.locator('html'));
      await (colorScheme === 'dark' ? theme : theme.not).toHaveClass(/\bdark\b/);

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      expect(violations).toEqual([]);
    });
  }

  test(`S8 has no horizontal scroll bar at 320 px in ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await openProduct(page, locale, shirt, 3);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    expect(overflow).toBe(0);
  });
}
