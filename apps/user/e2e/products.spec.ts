import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import {
  adminApi,
  createProduct,
  deleteProduct,
  deleteStaleProducts,
  type CreatedProduct,
  type ProductInput,
} from './support/products';

// S4, the products page of the store (SHOP-25: AC16, AC17, AC21; NFR3), on the real api: each group of tests reads
// products it creates through the admin API and deletes when done (NFR23). The tests of the file run in order in one
// worker, so a group's products are gone before the next group creates its own.
//
// Other files create products at the same time, and the catalog is cached for up to 25 s on the server (NFR7): a test
// reloads until the page shows what it expects, for up to 60 s, as the plan's Testing Strategy does. Until US5b (SHOP-28)
// brings the search, the page cannot be narrowed to the products of this run, so a test checks its own products and
// reads the total of the catalog from the progress line, rather than assuming the catalog holds only them.
test.describe.configure({ mode: 'default' });

const CACHE_WAIT = { timeout: 60_000 };

const COPY = {
  vi: {
    title: 'Sản phẩm',
    home: 'Trang chủ',
    list: 'Danh sách sản phẩm',
    outOfStock: 'Hết hàng',
    loadMore: 'Xem thêm',
    loading: 'Đang tải…',
    progress: /^Đã xem ([\d.]+) trên ([\d.]+) sản phẩm$/,
  },
  en: {
    title: 'Products',
    home: 'Home',
    list: 'Product list',
    outOfStock: 'Out of stock',
    loadMore: 'Load more',
    loading: 'Loading…',
    progress: /^Viewed ([\d,]+) of ([\d,]+) products?$/,
  },
} as const;

type Locale = keyof typeof COPY;

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await adminApi();
  await deleteStaleProducts(api);
});

test.afterAll(async () => {
  await api.dispose();
});

/** Creates products in order, oldest first, and deletes them after the tests of the group, even when one fails. */
function productsOfGroup(inputs: () => ProductInput[]) {
  const created: CreatedProduct[] = [];
  test.beforeAll(async () => {
    for (const input of inputs()) created.push(await createProduct(api, input));
  });
  test.afterAll(async () => {
    for (const product of created) await deleteProduct(api, product.id);
  });
  return created;
}

const grid = (page: Page, locale: Locale = 'vi') =>
  page.getByRole('main').getByRole('list', { name: COPY[locale].list });
const cards = (page: Page, locale: Locale = 'vi') => grid(page, locale).getByRole('listitem');
const loadMore = (page: Page, locale: Locale = 'vi') =>
  page.getByRole('main').getByRole('button', { name: COPY[locale].loadMore });

/** The names on the cards, in the order of the grid. */
const cardNames = (page: Page) => page.locator('main .product-card__name').allTextContents();

/** The paths of the cards, in the order of the grid. */
const cardPaths = (page: Page) =>
  grid(page)
    .getByRole('link')
    .evaluateAll((links) =>
      links.map((link) => new URL((link as HTMLAnchorElement).href).pathname),
    );

/** "Đã xem 24 trên 30 sản phẩm" as [24, 30]. */
async function progressOf(page: Page, locale: Locale = 'vi'): Promise<[number, number]> {
  const text = (await page.getByRole('main').getByRole('status').textContent()) ?? '';
  const match = COPY[locale].progress.exec(text.trim());
  expect(match, `progress line "${text}"`).not.toBeNull();
  const number = (value = '') => Number(value.replace(/[.,]/g, ''));
  return [number(match?.[1]), number(match?.[2])];
}

test.describe('products page shell', () => {
  for (const locale of ['vi', 'en'] as const) {
    test(`shows the title S4.2 and the BreadcrumbList in ${locale}`, async ({ page }) => {
      const { title, home } = COPY[locale];
      await page.goto(`/${locale}/products`);

      await expect(
        page.getByRole('main').getByRole('heading', { level: 1, name: title }),
      ).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      // Playwright does not match text inside <script>, so the JSON-LD blocks are read from the DOM.
      const blocks = await page
        .locator('script[type="application/ld+json"]')
        .evaluateAll((scripts) => scripts.map((script) => script.textContent ?? ''));
      const breadcrumbs = blocks
        .map(
          (block) =>
            JSON.parse(block) as { '@type'?: string; itemListElement?: { name: string }[] },
        )
        .filter((block) => block['@type'] === 'BreadcrumbList');
      expect(breadcrumbs.map((block) => block.itemListElement?.map((item) => item.name))).toEqual([
        [home, title],
      ]);
    });
  }

  test('has no product count route of the template', async ({ request }) => {
    const response = await request.get('/api/products/count');
    expect(response.status()).toBe(404);
  });
});

test.describe('AC16 products on sale', () => {
  const group = productsOfGroup(() => [
    { name: 'Áo sơ mi trắng', price: 320000 },
    { name: 'Áo len ẩn', price: 280000, status: 'HIDDEN' },
    { name: 'Váy hoa nhí', price: 410000 },
  ]);

  for (const locale of ['vi', 'en'] as const) {
    test(`AC16 shows only the products on sale, newest first, with no delete button in ${locale}`, async ({
      page,
    }) => {
      const [older, hidden, newer] = group;
      await expect(async () => {
        await page.goto(`/${locale}/products`);
        await expect(cards(page, locale).first()).toBeVisible();
        const names = await cardNames(page);
        expect(names).toContain(newer!.name);
        expect(names).toContain(older!.name);
        expect(names.indexOf(newer!.name)).toBeLessThan(names.indexOf(older!.name));
        // The hidden product was created between the two: on sale, it would be between them on the first page.
        expect(names).not.toContain(hidden!.name);
      }).toPass(CACHE_WAIT);

      const main = page.getByRole('main');
      await expect(main.getByRole('button', { name: /xóa|delete/i })).toHaveCount(0);
      await expect(main.getByText(/Fetched server-side|Total products/)).toHaveCount(0);
    });
  }
});

test.describe('AC17 product card', () => {
  const group = productsOfGroup(() => [
    {
      name: 'Áo thun cổ tròn',
      price: 1250000,
      compareAtPrice: 1500000,
      availability: 'OUT_OF_STOCK',
    },
  ]);

  for (const locale of ['vi', 'en'] as const) {
    test(`AC17 shows the placeholder, name, prices, "-16%" and the out of stock badge, and opens S5, in ${locale}`, async ({
      page,
    }) => {
      const [shirt] = group;
      const card = grid(page, locale).getByRole('link', {
        name: new RegExp(`^${shirt!.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`),
      });
      await expect(async () => {
        await page.goto(`/${locale}/products`);
        await expect(card).toBeVisible({ timeout: 2_000 });
      }).toPass(CACHE_WAIT);

      const tile = card.locator('[data-variant="card"]');
      await expect(tile).toBeVisible();
      await expect(tile).toHaveAttribute('aria-hidden', 'true');
      await expect(tile).toHaveText('Á');
      await expect(card.locator('.product-card__name')).toHaveText(shirt!.name);
      // The same prices on both pages: formatPrice in vi-VN, with U+00A0 before ₫.
      await expect(card.getByText('1.250.000 ₫', { exact: true })).toBeVisible();
      await expect(card.locator('s')).toHaveText('1.500.000 ₫');
      await expect(card.getByText('-16%', { exact: true })).toBeVisible();
      await expect(card.getByText(COPY[locale].outOfStock, { exact: true })).toBeVisible();

      await card.click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/products/${shirt!.slug}$`));
      await expect(page.getByRole('heading', { level: 1, name: shirt!.name })).toBeVisible();
    });
  }
});

test.describe('AC21 load more', () => {
  const created = productsOfGroup(() =>
    Array.from({ length: 30 }, (_, i) => ({
      name: `Sản phẩm ${String(i + 1).padStart(2, '0')}`,
      price: 100000 + i * 1000,
    })),
  );

  test('AC21 shows 24 products, the progress line and Xem thêm, then the rest below the first 24', async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const ours = () => created.map((product) => `/vi/products/${product.slug}`);

    await expect(async () => {
      await page.goto('/vi/products');
      await expect(cards(page)).toHaveCount(24);
      const [shown, total] = await progressOf(page);
      expect(shown).toBe(24);
      expect(total).toBeGreaterThanOrEqual(30);
      await expect(loadMore(page)).toBeVisible();
      const first = await cardPaths(page);
      const entries = await page.evaluate(() => history.length);

      // The first Load more: 24 more below, the first 24 where they were, the focus on the first new card, and the
      // number of loads in the URL, replaced and not pushed.
      await loadMore(page).click();
      await expect(cards(page)).toHaveCount(Math.min(48, total));
      expect((await cardPaths(page)).slice(0, 24)).toEqual(first);
      await expect(cards(page).nth(24).getByRole('link')).toBeFocused();
      await expect(page).toHaveURL(/\/vi\/products\?page=2$/);
      expect(await page.evaluate(() => history.length)).toBe(entries);

      // Load more until the end, however many products other runs left in the catalog.
      for (let loads = 2; (await loadMore(page).count()) > 0; loads += 1) {
        await loadMore(page).click();
        await expect(cards(page)).toHaveCount(Math.min(24 * (loads + 1), total));
      }

      await expect(cards(page)).toHaveCount(total);
      expect(await progressOf(page)).toEqual([total, total]);
      await expect(loadMore(page)).toHaveCount(0);
      expect(await cardPaths(page)).toEqual(expect.arrayContaining(ours()));
    }).toPass({ timeout: 150_000 });
  });

  test('S4.10 says it is loading, busy and locked, while the next products are on their way', async ({
    page,
  }) => {
    await page.goto('/vi/products');
    await expect(loadMore(page)).toBeVisible();
    // The navigation of Load more fetches the next page from the server: held back here, so the state can be seen.
    let release = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route(/\/vi\/products\?(.*&)?page=2(&|$)/, async (route) => {
      await held;
      await route.continue();
    });

    await loadMore(page).click();

    const button = page.getByRole('main').getByRole('button', { name: COPY.vi.loading });
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(cards(page)).toHaveCount(24);
    release();
    await expect(cards(page)).not.toHaveCount(24);
  });

  test('NFR3 opens ?page=999999 as a normal page within 2 s', async ({ page }) => {
    // The first visit compiles the route under next dev: not part of the 2 s.
    await page.goto('/vi/products');
    await expect(cards(page).first()).toBeVisible();

    const start = Date.now();
    await page.goto('/vi/products?page=999999');
    await expect(cards(page).first()).toBeVisible();
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(2_000);
    await expect(page.getByRole('heading', { level: 1, name: COPY.vi.title })).toBeVisible();
    const [shown, total] = await progressOf(page);
    expect(shown).toBe(total);
    await expect(cards(page)).toHaveCount(total);
    await expect(loadMore(page)).toHaveCount(0);
  });

  test('falls back to the first 24 products for a wrong page in the URL', async ({ page }) => {
    await page.goto('/vi/products?page=abc');

    await expect(cards(page)).toHaveCount(24);
    expect((await progressOf(page))[0]).toBe(24);
  });

  test('S4.5 lays the cards out in 1, 2, 3 and 4 columns, 16 px apart', async ({ page }) => {
    for (const [width, columns] of [
      [320, 1],
      [640, 2],
      [1024, 3],
      [1440, 4],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/vi/products');
      await expect(cards(page)).toHaveCount(24);
      const lefts = await cards(page).evaluateAll((items) =>
        items.slice(0, 5).map((item) => Math.round(item.getBoundingClientRect().left)),
      );
      expect(new Set(lefts).size, `columns at ${width} px`).toBe(columns);
      if (columns > 1) {
        const [a, b] = await cards(page).evaluateAll((items) =>
          items.slice(0, 2).map((item) => item.getBoundingClientRect()),
        );
        expect(Math.round(b!.left - a!.right), `gap at ${width} px`).toBe(16);
      }
    }
  });
});

test.describe('S4 at 320 px', () => {
  const group = productsOfGroup(() => [
    {
      name: 'Ááááááááááááááááááááááááááááááááááááááááááááááááááááááááááá dài',
      price: 999999999,
      compareAtPrice: null,
      availability: 'OUT_OF_STOCK',
    },
  ]);

  for (const locale of ['vi', 'en'] as const) {
    test(`has no horizontal scroll bar at 320 px in ${locale}`, async ({ page }) => {
      const [long] = group;
      await page.setViewportSize({ width: 320, height: 800 });
      await expect(async () => {
        await page.goto(`/${locale}/products`);
        await expect(page.locator('main .product-card__name', { hasText: long!.name })).toBeVisible(
          { timeout: 2_000 },
        );
      }).toPass(CACHE_WAIT);

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    });
  }
});
