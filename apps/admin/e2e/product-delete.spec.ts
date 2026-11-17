import AxeBuilder from '@axe-core/playwright';
import { type APIRequestContext, expect, type Locator, type Page, test } from '@playwright/test';

import { isLocal, userRequest } from './support/env';
import {
  createProduct,
  deleteProducts,
  deleteStaleE2eProducts,
  type E2eProduct,
  findProducts,
  newRunId,
} from './support/products';

// US4 (SHOP-37): S1.8 and the dialog S3 of docs/specs/SHOP-7/design.md against the real
// api, here or on Development, and the product page of the user app after a delete.
// Each test deletes the products of its run, made through the API, named
// `… E2E <runId>`. The tests run one after the other, so a search for the run sees the
// products of one test only. The tests that fail the DELETE in the browser run only on the
// apps started here: the SPEC forbids a mock of the product API on an environment.
test.describe.configure({ mode: 'default' });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const API = '/api/admin/products';
/** NFR7: a change of admin shows on the pages of the customer within 60 s. */
const STORE_DELAY_MS = 60_000;
const MOCKS_THE_API =
  'reason: fails the DELETE of the product API in the browser, which the SPEC forbids on an environment';

const runId = newRunId();
let created: E2eProduct[] = [];
let store: APIRequestContext;

test.beforeAll(async ({ request }) => {
  await deleteStaleE2eProducts(request);
  store = await userRequest();
});

test.afterEach(async ({ request }) => {
  // The products of this run, deleted or not: the api answers 204 for one already gone.
  await deleteProducts(request, [...created, ...(await findProducts(request, `e2e ${runId}`))]);
  created = [];
});

test.afterAll(async () => {
  await store.dispose();
});

/** The list S1 with only the products of this run. */
async function openList(page: Page) {
  await page.goto(`/products?q=${encodeURIComponent(`e2e ${runId}`)}`);
}

function rowOf(page: Page, name: string): Locator {
  return page
    .getByRole('table', { name: 'Product list' })
    .locator('tbody tr')
    .filter({ has: page.getByText(name, { exact: true }) });
}

/** Fails each DELETE of the product in the browser, as a lost connection would. */
async function failDeletes(page: Page, id: string): Promise<{ count: number }> {
  const deletes = { count: 0 };
  await page.route(`**${API}/${id}`, async (route) => {
    if (route.request().method() !== 'DELETE') return route.fallback();
    deletes.count += 1;
    return route.abort('connectionreset');
  });
  return deletes;
}

/** The HTTP status of a page load of the product detail page of the user app. */
async function storeStatus(slug: string): Promise<number> {
  const response = await store.get(`/vi/products/${slug}`, { maxRedirects: 0 });
  return response.status();
}

test.describe('US4 delete a product', () => {
  test('AC14 names the product, says it cannot be undone, suggests Hidden, and Cancel keeps the product', async ({
    page,
    request,
  }) => {
    const jeans = await createProduct(request, runId, { name: 'Quần jean nam' });
    created = [jeans];
    await openList(page);
    const deleteButton = page.getByRole('button', { name: `Delete ${jeans.name}` });

    await deleteButton.click();

    const dialog = page.getByRole('alertdialog', { name: `Delete “${jeans.name}”?` });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog.getByText("This can't be undone.", { exact: true })).toBeVisible();
    await expect(
      dialog.getByText('To stop selling it for now, set its status to Hidden instead.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();

    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(dialog).toBeHidden();
    await expect(deleteButton).toBeFocused();
    await expect(rowOf(page, jeans.name)).toBeVisible();
    expect((await findProducts(request, `e2e ${runId}`)).map((item) => item.id)).toEqual([
      jeans.id,
    ]);
  });

  test('AC14 Esc acts as Cancel, and Tab stays in the dialog', async ({ page, request }) => {
    const jeans = await createProduct(request, runId, { name: 'Quần jean nam' });
    created = [jeans];
    await openList(page);
    const deleteButton = page.getByRole('button', { name: `Delete ${jeans.name}` });
    await deleteButton.click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();

    // Cancel, Delete, Close, then back to Cancel: never the page behind.
    for (const name of ['Delete', 'Close', 'Cancel']) {
      await page.keyboard.press('Tab');
      await expect(dialog.getByRole('button', { name, exact: true })).toBeFocused();
    }
    await page.keyboard.press('Escape');

    await expect(dialog).toBeHidden();
    await expect(deleteButton).toBeFocused();
    await expect(rowOf(page, jeans.name)).toBeVisible();
  });

  test('AC15 deletes the product: "Product deleted", gone from admin, 404 on the store within 60 s, and its slug free again', async ({
    page,
    request,
  }) => {
    const jeans = await createProduct(request, runId, { name: 'Quần jean nam' });
    created = [jeans];
    // On sale first, so the 404 below comes from the delete.
    await expect.poll(() => storeStatus(jeans.slug), { timeout: STORE_DELAY_MS }).toBe(200);
    await openList(page);
    await page.getByRole('button', { name: `Delete ${jeans.name}` }).click();
    const dialog = page.getByRole('alertdialog', { name: `Delete “${jeans.name}”?` });

    // The 60 s of NFR7 count from the delete, not from the checks of admin below.
    const deletedAt = Date.now();
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Product deleted' })).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(rowOf(page, jeans.name)).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Product list' })).toBeFocused();
    expect(await findProducts(request, `e2e ${runId}`)).toEqual([]);
    await page.reload();
    await expect(page.getByText('No matching products')).toBeVisible();

    const left = Math.max(1, STORE_DELAY_MS - (Date.now() - deletedAt));
    await expect
      .poll(() => storeStatus(jeans.slug), { timeout: left, intervals: [2_000] })
      .toBe(404);

    const again = await request.post(API, {
      data: {
        name: jeans.name,
        slug: jeans.slug,
        price: 100000,
        status: 'ACTIVE',
        availability: 'IN_STOCK',
      },
    });
    expect(again.status(), await again.text()).toBe(201);
    const reused = (await again.json()) as E2eProduct;
    created.push(reused);
    expect(reused.slug).toBe(jeans.slug);
  });

  test('keeps S3 open with its error when the DELETE fails, and sends it once (NFR19)', async ({
    page,
    request,
    baseURL,
  }) => {
    test.skip(!isLocal(baseURL), MOCKS_THE_API);
    const jeans = await createProduct(request, runId, { name: 'Quần jean nam' });
    created = [jeans];
    const deletes = await failDeletes(page, jeans.id);
    await openList(page);
    await page.getByRole('button', { name: `Delete ${jeans.name}` }).click();
    const dialog = page.getByRole('alertdialog');

    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(dialog.getByRole('alert')).toHaveText("Couldn't delete. Please try again.");
    await expect(dialog).toBeVisible();
    expect(deletes.count).toBe(1);
    await expect(page.getByRole('status').filter({ hasText: 'Product deleted' })).toHaveCount(0);
    expect((await findProducts(request, `e2e ${runId}`)).map((item) => item.id)).toEqual([
      jeans.id,
    ]);
  });

  test('S3 speaks Vietnamese', async ({ page, request }) => {
    const jeans = await createProduct(request, runId, { name: 'Quần jean nam' });
    created = [jeans];
    await openList(page);
    await page.getByLabel('Language').selectOption('vi');

    await page.getByRole('button', { name: `Xóa ${jeans.name}` }).click();

    const dialog = page.getByRole('alertdialog', { name: `Xóa “${jeans.name}”?` });
    await expect(dialog.getByText('Việc xóa không hoàn tác được.', { exact: true })).toBeVisible();
    await expect(
      dialog.getByText('Nếu chỉ muốn tạm ngừng bán, hãy chọn Ẩn.', { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Hủy' })).toBeFocused();
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`S3 has no WCAG A/AA violation in the ${colorScheme} theme`, async ({ page, request }) => {
      const jeans = await createProduct(request, runId, { name: 'Quần jean nam' });
      created = [jeans];
      await page.emulateMedia({ colorScheme });
      await openList(page);

      await page.getByRole('button', { name: `Delete ${jeans.name}` }).click();

      await expect(page.getByRole('alertdialog')).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);
    });

    test(`S3 with its error S3.6 has no WCAG A/AA violation in the ${colorScheme} theme`, async ({
      page,
      request,
      baseURL,
    }) => {
      test.skip(!isLocal(baseURL), MOCKS_THE_API);
      const jeans = await createProduct(request, runId, { name: 'Quần jean nam' });
      created = [jeans];
      await page.emulateMedia({ colorScheme });
      await failDeletes(page, jeans.id);
      await openList(page);
      await page.getByRole('button', { name: `Delete ${jeans.name}` }).click();
      const dialog = page.getByRole('alertdialog');

      await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

      await expect(dialog.getByRole('alert')).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);
    });
  }
});
