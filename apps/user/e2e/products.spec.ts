import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import {
  adminApi,
  createProduct,
  deleteProduct,
  deleteStaleProducts,
  runId,
  type CreatedProduct,
  type ProductInput,
} from './support/products';

// S4, the products page of the store (SHOP-25: AC16, AC17, AC21; SHOP-28: AC18–AC20, AC22, AC23; NFR3), on the real
// api: each group of tests reads products it creates through the admin API and deletes when done (NFR23). The tests of
// the file run in order in one worker, so a group's products are gone before the next group creates its own.
//
// Other files create products at the same time, and the catalog is cached for up to 25 s on the server (NFR7): a test
// reloads until the page shows what it expects, for up to 60 s, as the plan's Testing Strategy does. A test that counts
// products, or needs exactly its own in an order, searches `e2e <runId>`: every product of this run, and only those,
// has those two words in its name (plan of SHOP-7, Architecture Decisions 16). The order of relevance (AC19) depends on
// the words of the keyword, so its test searches without them and checks the order of its own products among the
// others.
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
    search: 'Tìm theo tên',
    sort: 'Sắp xếp',
    noResults: (q: string) => `Không tìm thấy sản phẩm nào cho “${q}”`,
    clearSearch: 'Xóa tìm kiếm',
    empty: 'Chưa có sản phẩm nào.',
  },
  en: {
    title: 'Products',
    home: 'Home',
    list: 'Product list',
    outOfStock: 'Out of stock',
    loadMore: 'Load more',
    loading: 'Loading…',
    progress: /^Viewed ([\d,]+) of ([\d,]+) products?$/,
    search: 'Search by name',
    sort: 'Sort by',
    noResults: (q: string) => `No products found for “${q}”`,
    clearSearch: 'Clear search',
    empty: 'No products yet.',
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

const searchField = (page: Page, locale: Locale = 'vi') =>
  page.getByRole('main').getByRole('searchbox', { name: COPY[locale].search });
const sortSelect = (page: Page, locale: Locale = 'vi') =>
  page.getByRole('main').getByRole('combobox', { name: COPY[locale].sort });

/** The keyword that narrows the page to the products of this run, after the words of a test. */
const ofThisRun = (words = '') => `${words} e2e ${runId}`.trim();

/** The path of S4 for `params`, as the page writes it: a space of the keyword is a `+`. */
const productsUrl = (params: Record<string, string>, locale: Locale = 'vi') =>
  `/${locale}/products?${new URLSearchParams(params).toString()}`;

/** Types `keyword` in the search S4.3 and presses Enter, as a visitor does, and waits for the URL of that search. */
async function search(page: Page, keyword: string, locale: Locale = 'vi') {
  await searchField(page, locale).fill(keyword);
  await searchField(page, locale).press('Enter');
  await expect(page).toHaveURL((url) => url.searchParams.get('q') === keyword);
}

/**
 * Chooses `label` in the sort S4.4, and waits for the URL of that sort. A choice made before React takes over the page
 * does nothing, and the select shows the sort of the URL again once it does: the test chooses again until the URL
 * follows. (The search needs no such retry: before React, Enter sends the GET form.)
 */
async function sortBy(page: Page, label: string, sort: string) {
  await expect(async () => {
    await sortSelect(page).selectOption({ label });
    await expect(page).toHaveURL((url) => url.searchParams.get('sort') === sort, {
      timeout: 2_000,
    });
  }).toPass();
}

/** Presses Load more until every product of the page is shown. */
async function loadAll(page: Page) {
  while ((await loadMore(page).count()) > 0) {
    const before = await cards(page).count();
    await loadMore(page).click();
    await expect(cards(page)).not.toHaveCount(before);
  }
}

/** The names of the products of this run on the cards, in the order of the grid, without the label of the run. */
async function namesOfThisRun(page: Page): Promise<string[]> {
  const label = ` E2E ${runId}`;
  return (await cardNames(page))
    .filter((name) => name.endsWith(label))
    .map((name) => name.slice(0, -label.length));
}

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

  test('AC21 shows 24 products, "Đã xem 24 trên 30 sản phẩm" and Xem thêm, then the 6 others below the first 24', async ({
    page,
  }) => {
    const ours = created.map((product) => `/vi/products/${product.slug}`);
    const progress = page.getByRole('main').getByRole('status');

    // Narrowed to the 30 products of this run (Verification of SHOP-28).
    await expect(async () => {
      await page.goto(productsUrl({ q: ofThisRun() }));
      await expect(cards(page)).toHaveCount(24, { timeout: 2_000 });
    }).toPass(CACHE_WAIT);
    await expect(progress).toHaveText('Đã xem 24 trên 30 sản phẩm');
    await expect(loadMore(page)).toBeVisible();
    const first = await cardPaths(page);
    expect(ours).toEqual(expect.arrayContaining(first));
    const entries = await page.evaluate(() => history.length);

    await loadMore(page).click();

    // Exactly the 6 others, below the first 24 which stay where they were; the focus on the first new card; no Load
    // more; and the number of loads in the URL with the search, replaced and not pushed.
    await expect(cards(page)).toHaveCount(30);
    const all = await cardPaths(page);
    expect(all.slice(0, 24)).toEqual(first);
    expect(all.slice(24).sort()).toEqual(ours.filter((path) => !first.includes(path)).sort());
    await expect(cards(page).nth(24).getByRole('link')).toBeFocused();
    await expect(progress).toHaveText('Đã xem 30 trên 30 sản phẩm');
    await expect(loadMore(page)).toHaveCount(0);
    await expect(page).toHaveURL(
      (url) => url.searchParams.get('q') === ofThisRun() && url.searchParams.get('page') === '2',
    );
    expect(await page.evaluate(() => history.length)).toBe(entries);
  });

  test('S4.10 says it is loading, busy and locked, while the next products are on their way', async ({
    page,
  }) => {
    // The page without a search may still be cached from before this group's products were created.
    await expect(async () => {
      await page.goto('/vi/products');
      await expect(loadMore(page)).toBeVisible({ timeout: 2_000 });
    }).toPass(CACHE_WAIT);
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

test.describe('AC18 search by name', () => {
  const group = productsOfGroup(() => [
    { name: 'Áo thun cổ tròn', price: 250000 },
    { name: 'Bao tay len', price: 90000 },
    { name: 'Quần jean nam', price: 450000 },
  ]);

  for (const words of ['ao thun', 'ÁO THUN', 'Áo Thun']) {
    test(`AC18 finds only "Áo thun cổ tròn" for "${words}", whatever the case and the accents`, async ({
      page,
    }) => {
      const [shirt] = group;
      const keyword = ofThisRun(words);

      await expect(async () => {
        await page.goto('/vi/products');
        await search(page, keyword);
        await expect(cards(page)).toHaveCount(1, { timeout: 2_000 });
      }).toPass(CACHE_WAIT);

      expect(await cardNames(page)).toEqual([shirt!.name]);
      // The field keeps the keyword, and the order is relevance, chosen by default.
      await expect(searchField(page)).toHaveValue(keyword);
      await expect(sortSelect(page)).toHaveValue('relevance');
      await expect(sortSelect(page).locator('option:checked')).toHaveText('Liên quan nhất');
    });
  }

  test('AC18 finds "Áo thun cổ tròn" and not "Bao tay len" for "ao", which only starts a word of the first', async ({
    page,
  }) => {
    await expect(async () => {
      await page.goto('/vi/products');
      await search(page, ofThisRun('ao'));
      await expect(cards(page)).toHaveCount(1, { timeout: 2_000 });
    }).toPass(CACHE_WAIT);

    expect(await namesOfThisRun(page)).toEqual(['Áo thun cổ tròn']);
    await expect(searchField(page)).toHaveValue(ofThisRun('ao'));
  });
});

test.describe('AC19 most relevant first', () => {
  productsOfGroup(() => [
    { name: 'Áo thun cổ tròn', price: 250000 },
    { name: 'Combo 3 áo thun', price: 399000 },
    { name: 'Áo khoác thun nỉ', price: 520000 },
  ]);

  test('AC19 lists "Áo thun cổ tròn", "Combo 3 áo thun", then "Áo khoác thun nỉ" for "ao thun"', async ({
    page,
  }) => {
    // The keyword without the words of the run, which would take every name out of the first two groups: the test
    // checks the order of its own products among those of the catalog.
    await expect(async () => {
      await page.goto('/vi/products');
      await search(page, 'ao thun');
      await expect(sortSelect(page)).toHaveValue('relevance');
      await loadAll(page);
      expect(await namesOfThisRun(page)).toEqual([
        'Áo thun cổ tròn',
        'Combo 3 áo thun',
        'Áo khoác thun nỉ',
      ]);
    }).toPass(CACHE_WAIT);
  });
});

test.describe('AC20 sort by price and newest', () => {
  // Created oldest first: two at 200.000 ₫, of which "Giày D" is the newer.
  productsOfGroup(() => [
    { name: 'Giày A', price: 300000 },
    { name: 'Giày B', price: 100000 },
    { name: 'Giày C', price: 200000 },
    { name: 'Giày D', price: 200000 },
  ]);

  test('AC20 has no "Liên quan nhất" without a search, and Mới nhất by default', async ({
    page,
  }) => {
    await page.goto('/vi/products');

    await expect(sortSelect(page)).toHaveValue('newest');
    await expect(sortSelect(page).getByRole('option')).toHaveText([
      'Mới nhất',
      'Giá thấp đến cao',
      'Giá cao đến thấp',
    ]);
  });

  test('AC20 sorts by price, low to high and high to low, the newer first at the same price, and by newest', async ({
    page,
  }) => {
    // The sort is chosen first, without a search, then kept by the search that narrows the page to this run.
    await page.goto('/vi/products');
    await sortBy(page, 'Giá thấp đến cao', 'price-asc');
    await expect(async () => {
      await search(page, ofThisRun());
      await expect(cards(page)).toHaveCount(4, { timeout: 2_000 });
    }).toPass(CACHE_WAIT);
    await expect(page).toHaveURL((url) => url.searchParams.get('sort') === 'price-asc');
    expect(await namesOfThisRun(page)).toEqual(['Giày B', 'Giày D', 'Giày C', 'Giày A']);

    await sortBy(page, 'Giá cao đến thấp', 'price-desc');
    await expect.poll(() => namesOfThisRun(page)).toEqual(['Giày A', 'Giày D', 'Giày C', 'Giày B']);

    await sortBy(page, 'Mới nhất', 'newest');
    await expect.poll(() => namesOfThisRun(page)).toEqual(['Giày D', 'Giày C', 'Giày B', 'Giày A']);
    await expect(searchField(page)).toHaveValue(ofThisRun());
  });
});

test.describe('AC22 search, sort and load more in the URL', () => {
  // 26 products, the oldest the cheapest: low to high is not the newest first.
  productsOfGroup(() =>
    Array.from({ length: 26 }, (_, i) => ({
      name: `Áo mẫu ${String(i + 1).padStart(2, '0')}`,
      price: 100000 + i * 1000,
    })),
  );

  const cheapestFirst = Array.from(
    { length: 26 },
    (_, i) => `Áo mẫu ${String(i + 1).padStart(2, '0')}`,
  );

  test('AC22 shows the same keyword, sort and products after a reload and in another tab', async ({
    page,
    context,
  }) => {
    const keyword = ofThisRun('ao');
    await expect(async () => {
      await page.goto('/vi/products');
      await search(page, keyword);
      await expect(cards(page)).toHaveCount(24, { timeout: 2_000 });
    }).toPass(CACHE_WAIT);
    await sortBy(page, 'Giá thấp đến cao', 'price-asc');
    await expect.poll(() => namesOfThisRun(page)).toEqual(cheapestFirst.slice(0, 24));
    await loadMore(page).click();
    await expect(cards(page)).toHaveCount(26);
    await expect(page).toHaveURL(
      (url) =>
        url.searchParams.get('q') === keyword &&
        url.searchParams.get('sort') === 'price-asc' &&
        url.searchParams.get('page') === '2',
    );
    expect(await namesOfThisRun(page)).toEqual(cheapestFirst);

    await page.reload();

    await expect(cards(page)).toHaveCount(26);
    expect(await namesOfThisRun(page)).toEqual(cheapestFirst);
    await expect(searchField(page)).toHaveValue(keyword);
    await expect(sortSelect(page)).toHaveValue('price-asc');

    const tab = await context.newPage();
    await tab.goto(page.url());

    await expect(cards(tab)).toHaveCount(26);
    expect(await namesOfThisRun(tab)).toEqual(cheapestFirst);
    await expect(searchField(tab)).toHaveValue(keyword);
    await expect(sortSelect(tab)).toHaveValue('price-asc');
  });

  test('AC22 reads a wrong sort and page as their defaults while searching, without an error', async ({
    page,
  }) => {
    const keyword = ofThisRun('ao');
    await expect(async () => {
      await page.goto(productsUrl({ q: keyword, sort: 'cheapest', page: '-1' }));
      await expect(cards(page)).toHaveCount(24, { timeout: 2_000 });
    }).toPass(CACHE_WAIT);

    await expect(page.getByRole('heading', { level: 1, name: COPY.vi.title })).toBeVisible();
    // In the page: the route announcer of Next is an alert of its own, outside it.
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
    await expect(searchField(page)).toHaveValue(keyword);
    await expect(sortSelect(page)).toHaveValue('relevance');
    // Relevance, then the newest first: no name holds the keyword as one phrase, so all 26 are in the same group.
    expect(await namesOfThisRun(page)).toEqual(cheapestFirst.slice(2).reverse());
  });

  test('AC22 reads relevance without a search as the newest first, without an error', async ({
    page,
  }) => {
    await page.goto(productsUrl({ sort: 'relevance', page: 'abc' }));

    await expect(cards(page)).toHaveCount(24);
    // In the page: the route announcer of Next is an alert of its own, outside it.
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
    await expect(searchField(page)).toHaveValue('');
    await expect(sortSelect(page)).toHaveValue('newest');
    await expect(sortSelect(page).getByRole('option', { name: 'Liên quan nhất' })).toHaveCount(0);
  });
});

test.describe('AC23 no product', () => {
  for (const locale of ['vi', 'en'] as const) {
    test(`AC23 says no product matches "xyz", and Clear search goes back to every product, in ${locale}`, async ({
      page,
    }) => {
      const { noResults, clearSearch } = COPY[locale];
      await page.goto(`/${locale}/products`);
      await search(page, 'xyz', locale);

      const main = page.getByRole('main');
      await expect(main.getByRole('status')).toHaveText(noResults('xyz'));
      await expect(grid(page, locale)).toHaveCount(0);
      await expect(loadMore(page, locale)).toHaveCount(0);
      await expect(searchField(page, locale)).toHaveValue('xyz');

      await main.getByRole('link', { name: clearSearch }).click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/products$`));
      await expect(searchField(page, locale)).toHaveValue('');
      await expect(sortSelect(page, locale)).toHaveValue('newest');
    });
  }

  // Development always has products on sale: only the apps started here can have none (SPEC, Testing Strategy).
  test(
    'AC23 says "Chưa có sản phẩm nào." when no product is on sale',
    { tag: '@local' },
    async ({ page }) => {
      const response = await api.get('/api/admin/products', {
        params: { status: 'ACTIVE', offset: 0, limit: 1 },
      });
      expect(response.status()).toBe(200);
      const { totalItems } = (await response.json()) as { totalItems: number };
      // The test hides and deletes no product it did not create (NFR23), so it needs a catalog with none on sale.
      // The local database, or tests running beside this one, may hold some.
      test.skip(totalItems > 0, `reason: ${totalItems} local product(s) on sale; AC23 needs none`);

      await expect(async () => {
        await page.goto('/vi/products');
        await expect(page.getByRole('main').getByRole('status')).toHaveText(COPY.vi.empty, {
          timeout: 2_000,
        });
      }).toPass(CACHE_WAIT);
      await expect(grid(page)).toHaveCount(0);
      await expect(
        page.getByRole('main').getByRole('link', { name: COPY.vi.clearSearch }),
      ).toHaveCount(0);
    },
  );
});

test.describe('S4.3 and S4.4 layout', () => {
  test('puts the search and the sort on one row from 768 px, one above the other under it', async ({
    page,
  }) => {
    for (const [width, oneRow] of [
      [320, false],
      [767, false],
      [768, true],
      [1440, true],
    ] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/vi/products');
      const field = await searchField(page).boundingBox();
      const select = await sortSelect(page).boundingBox();
      expect(field, `search at ${width} px`).not.toBeNull();
      expect(select, `sort at ${width} px`).not.toBeNull();
      if (oneRow) {
        expect(Math.round(select!.y), `one row at ${width} px`).toBe(Math.round(field!.y));
      } else {
        expect(select!.y, `stacked at ${width} px`).toBeGreaterThanOrEqual(
          field!.y + field!.height,
        );
      }
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `scroll at ${width} px`).toBe(0);
    }
  });
});
