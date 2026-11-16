import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';

import {
  createProducts,
  deleteProducts,
  deleteStaleE2eProducts,
  type E2eProduct,
  e2eName,
  newRunId,
} from './support/products';

// US1 (SHOP-19): S1 of docs/specs/SHOP-7/design.md against the real api, here or on
// Development. Each test makes its own products, named `… E2E <runId>`, and deletes
// them after. The tests of this file run one after the other, so the 25 products of
// AC4 never push the products of another test off page 1.
test.describe.configure({ mode: 'default' });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

const runId = newRunId();
let created: E2eProduct[] = [];

test.beforeAll(async ({ request }) => {
  await deleteStaleE2eProducts(request);
});

test.afterEach(async ({ request }) => {
  await deleteProducts(request, created);
  created = [];
});

// Like app.search_fold of the api: no accents, đ as d, lower case.
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

function table(page: Page): Locator {
  return page.getByRole('table', { name: 'Product list' });
}

function bodyRows(page: Page): Locator {
  return table(page).locator('tbody tr');
}

function rowOf(page: Page, name: string): Locator {
  return bodyRows(page).filter({ hasText: name });
}

// Waits out the 300 ms after typing (S1.5), until the URL holds the keyword.
async function search(page: Page, keyword: string): Promise<void> {
  await page.getByRole('searchbox', { name: 'Search by name' }).fill(keyword);
  await expect(page).toHaveURL((url) => url.searchParams.get('q') === keyword);
}

test.describe('US1 admin product list', () => {
  test('AC1 lists active and hidden products, newest first, without signing in', async ({
    page,
    request,
  }) => {
    created = await createProducts(request, runId, [
      { name: 'Đầm maxi đỏ', price: 1250000, status: 'HIDDEN', availability: 'OUT_OF_STOCK' },
      { name: 'Áo thun cổ tròn', price: 200000 },
    ]);
    const [dress, shirt] = created as [E2eProduct, E2eProduct];

    await page.goto('/products');

    await expect(page).toHaveURL(/\/products$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible();
    const shirtRow = rowOf(page, shirt.name);
    const dressRow = rowOf(page, dress.name);
    await expect(shirtRow).toBeVisible();
    await expect(dressRow).toBeVisible();

    await expect(shirtRow.locator('.tile')).toHaveText('Á');
    await expect(shirtRow.getByRole('cell').nth(1)).toHaveText(/^200\.000\s₫$/);
    await expect(shirtRow.getByText('Active', { exact: true })).toBeVisible();
    await expect(shirtRow.getByText('In stock', { exact: true })).toBeVisible();
    await expect(dressRow.getByText(dress.slug)).toBeVisible();
    await expect(dressRow.getByRole('cell').nth(1)).toHaveText(/^1\.250\.000\s₫$/);
    await expect(dressRow.getByText('Hidden', { exact: true })).toBeVisible();
    await expect(dressRow.getByText('Out of stock', { exact: true })).toBeVisible();

    const names = await bodyRows(page).locator('.table__name').allTextContents();
    expect(names.indexOf(shirt.name)).toBeLessThan(names.indexOf(dress.name));
  });

  test('AC2 keeps only the products whose name matches the keyword, and offers to clear a search with no match', async ({
    page,
    request,
  }) => {
    created = await createProducts(request, runId, [
      { name: 'Áo thun cổ tròn' },
      { name: 'Quần jean nam' },
    ]);
    const [shirt, jeans] = created as [E2eProduct, E2eProduct];
    await page.goto('/products');
    await expect(rowOf(page, jeans.name)).toBeVisible();

    await search(page, 'AO THUN');

    await expect(rowOf(page, jeans.name)).toHaveCount(0);
    await expect(rowOf(page, shirt.name)).toBeVisible();
    // Every product left has a word starting with "ao" and one starting with "thun",
    // ignoring case and accents.
    for (const name of await bodyRows(page).locator('.table__name').allTextContents()) {
      const words = fold(name).split(/\s+/);
      const hasBoth =
        words.some((word) => word.startsWith('ao')) &&
        words.some((word) => word.startsWith('thun'));
      expect(hasBoth, name).toBe(true);
    }

    await search(page, 'xyz');

    await expect(page.getByText('No matching products')).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).toHaveURL(/\/products$/);
    await expect(rowOf(page, jeans.name)).toBeVisible();
    await expect(page.getByRole('searchbox', { name: 'Search by name' })).toBeFocused();
  });

  test('AC3 shows only hidden products under Hidden, and both under All', async ({
    page,
    request,
  }) => {
    created = await createProducts(request, runId, [
      { name: 'Áo khoác', status: 'ACTIVE' },
      { name: 'Bao tay len', status: 'HIDDEN' },
    ]);
    const [active, hidden] = created as [E2eProduct, E2eProduct];
    await page.goto('/products');
    const filter = page.getByRole('group', { name: 'Filter by status' });

    await filter.getByRole('button', { name: 'Hidden' }).click();

    await expect(page).toHaveURL(/status=hidden/);
    await expect(rowOf(page, hidden.name)).toBeVisible();
    await expect(rowOf(page, active.name)).toHaveCount(0);
    for (const status of await bodyRows(page).locator('td:nth-child(3)').allTextContents()) {
      expect(status).toBe('Hidden');
    }

    await filter.getByRole('button', { name: 'All' }).click();

    await expect(rowOf(page, active.name)).toBeVisible();
    await expect(rowOf(page, hidden.name)).toBeVisible();
  });

  test('AC4 pages 25 products by 20, and keeps the keyword, the filter and the page on reload and in another tab', async ({
    page,
    context,
    request,
  }) => {
    test.setTimeout(90_000);
    created = await createProducts(
      request,
      runId,
      Array.from({ length: 25 }, (_, index) => ({
        name: `Sản phẩm ${String(index + 1).padStart(2, '0')}`,
      })),
    );
    const newestFirst = created.map((product) => product.name).reverse();
    await page.goto('/products');
    await page
      .getByRole('group', { name: 'Filter by status' })
      .getByRole('button', { name: 'Active' })
      .click();
    await search(page, `e2e ${runId}`);

    await expect(page.getByText('Showing 1–20 of 25')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: '25 products' })).toBeVisible();
    await expect(bodyRows(page).locator('.table__name')).toHaveText(newestFirst.slice(0, 20));

    await page.getByRole('link', { name: 'Page 2' }).click();

    await expect(page.getByText('Showing 21–25 of 25')).toBeVisible();
    await expect(bodyRows(page).locator('.table__name')).toHaveText(newestFirst.slice(20));
    const url = page.url();
    expect(new URL(url).searchParams.get('page')).toBe('2');

    for (const view of [page, await context.newPage()]) {
      await (view === page ? view.reload() : view.goto(url));
      await expect(view.getByRole('searchbox', { name: 'Search by name' })).toHaveValue(
        `e2e ${runId}`,
      );
      await expect(
        view
          .getByRole('group', { name: 'Filter by status' })
          .getByRole('button', { name: 'Active' }),
      ).toHaveAttribute('aria-pressed', 'true');
      await expect(view.getByRole('link', { name: 'Page 2' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await expect(bodyRows(view).locator('.table__name')).toHaveText(newestFirst.slice(20));
    }
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`S1 has no WCAG A/AA violation in the ${colorScheme} theme`, async ({ page, request }) => {
      created = await createProducts(request, runId, [
        { name: 'Áo thun cổ tròn', status: 'ACTIVE', availability: 'IN_STOCK' },
        { name: 'Quần jean nam', status: 'HIDDEN', availability: 'OUT_OF_STOCK' },
      ]);
      await page.emulateMedia({ colorScheme });
      await page.goto('/products');
      await expect(rowOf(page, e2eName('Quần jean nam', runId))).toBeVisible();

      const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

      expect(violations).toEqual([]);
    });
  }
});
