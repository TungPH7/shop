import AxeBuilder from '@axe-core/playwright';
import {
  type APIRequestContext,
  type BrowserContext,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test';

import { userContext, userRequest } from './support/env';
import {
  createProduct,
  deleteProducts,
  deleteStaleE2eProducts,
  type E2eProduct,
  e2eName,
  findProducts,
  newRunId,
} from './support/products';

// US3 (SHOP-34): S2 of docs/specs/SHOP-7/design.md in edit mode against the real api,
// here or on Development, and the pages of the user app after a save. Each test
// deletes the products of its run, made through the API, named `… E2E <runId>`. The
// tests run one after the other, so a search for the run sees the products of one test
// only. The store caches the catalog: a change shows there within 60 s (NFR7), so a
// check of the store polls for up to 60 s from the save.
test.describe.configure({ mode: 'default' });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const API = '/api/admin/products';
/** NFR7: a change of admin shows on the pages of the customer within 60 s. */
const STORE_DELAY_MS = 60_000;
/** A test that waits for the store, maybe twice, on top of its own steps. */
const STORE_TEST_TIMEOUT_MS = 3 * STORE_DELAY_MS;

const runId = newRunId();
let created: E2eProduct[] = [];
let store: APIRequestContext;
let storeBrowser: BrowserContext;

test.beforeAll(async ({ request, browser }) => {
  await deleteStaleE2eProducts(request);
  store = await userRequest();
  storeBrowser = await userContext(browser);
});

test.afterEach(async ({ request }) => {
  await deleteProducts(request, [...created, ...(await findProducts(request, `e2e ${runId}`))]);
  created = [];
});

test.afterAll(async () => {
  await store.dispose();
  await storeBrowser.close();
});

function form(page: Page) {
  return {
    name: page.getByRole('textbox', { name: /^Product name/ }),
    slug: page.getByRole('textbox', { name: 'URL slug' }),
    price: page.getByRole('textbox', { name: /^Price/ }),
    compareAtPrice: page.getByRole('textbox', { name: 'Compare-at price (₫) (optional)' }),
    save: page.getByRole('button', { name: 'Save changes' }),
  };
}

/** S2 in edit mode for the product, once it has loaded. */
async function openEdit(page: Page, product: E2eProduct) {
  await page.goto(`/products/${product.id}/edit`);
  await expect(page.getByRole('heading', { level: 1, name: 'Edit product' })).toBeVisible();
  await expect(form(page).name).toHaveValue(product.name);
}

/**
 * Picks an option of S2.11 or S2.12 as a person does, on its label: the radio itself
 * is hidden under the label of the segmented control.
 */
async function choose(page: Page, option: string) {
  await page
    .locator('label')
    .filter({ has: page.getByRole('radio', { name: option, exact: true }) })
    .click();
  await expect(page.getByRole('radio', { name: option, exact: true })).toBeChecked();
}

function rowOf(page: Page, name: string): Locator {
  return page
    .getByRole('table', { name: 'Product list' })
    .locator('tbody tr')
    .filter({ has: page.getByText(name, { exact: true }) });
}

async function expectSaved(page: Page) {
  await expect(page.getByRole('status').filter({ hasText: 'Product saved' })).toBeVisible();
  await expect(page).toHaveURL(/\/products$/);
}

/** The time left of the 60 s of NFR7 that started at `savedAt`. */
function leftOf(savedAt: number): number {
  return Math.max(1, STORE_DELAY_MS - (Date.now() - savedAt));
}

/** The HTTP status of a page load of the product detail page of the user app. */
async function storeStatus(slug: string): Promise<number> {
  const response = await store.get(`/vi/products/${slug}`, { maxRedirects: 0 });
  return response.status();
}

/** Whether the first page of the store list names the product. */
async function storeListHas(name: string): Promise<boolean> {
  const response = await store.get('/vi/products');
  expect(response.status()).toBe(200);
  return (await response.text()).includes(name);
}

/** Whether /sitemap.xml of the store has a link to the slug. */
async function sitemapHas(slug: string): Promise<boolean> {
  const response = await store.get('/sitemap.xml');
  expect(response.status()).toBe(200);
  return (await response.text()).includes(`/products/${slug}<`);
}

test.describe('US3 edit a product', () => {
  test('AC9 saves a new name and prices, keeps the slug, and the store shows them with the discount within 60 s', async ({
    page,
    request,
  }) => {
    test.setTimeout(STORE_TEST_TIMEOUT_MS);
    const shirt = await createProduct(request, runId, { name: 'Áo thun cổ tròn', price: 250000 });
    created = [shirt];
    const newName = e2eName('Áo thun cổ tròn basic', runId);
    await page.goto(`/products?q=${encodeURIComponent(`e2e ${runId}`)}`);
    await page.getByRole('link', { name: `Edit ${shirt.name}` }).click();
    await expect(page).toHaveURL(new RegExp(`/products/${shirt.id}/edit$`));
    const fields = form(page);
    await expect(fields.name).toHaveValue(shirt.name);
    await expect(fields.price).toHaveValue('250.000');

    await fields.name.fill(newName);
    await expect(fields.slug).toHaveValue(shirt.slug);
    await fields.price.fill('200000');
    await fields.compareAtPrice.fill('250000');
    const savedAt = Date.now();
    await fields.save.click();

    await expectSaved(page);
    const row = rowOf(page, newName);
    await expect(row.getByRole('cell').nth(1)).toHaveText(/^200\.000\s₫$/);
    await expect(row.getByText(shirt.slug, { exact: true })).toBeVisible();
    const [saved] = await findProducts(request, `e2e ${runId}`);
    expect(saved).toMatchObject({ id: shirt.id, name: newName, slug: shirt.slug, price: 200000 });

    const detail = await storeBrowser.newPage();
    const heading = detail.getByRole('heading', { level: 1 });
    await expect
      .poll(
        async () => {
          await detail.goto(`/vi/products/${shirt.slug}`);
          return heading.textContent();
        },
        { timeout: leftOf(savedAt), intervals: [2_000] },
      )
      .toBe(newName);
    const main = detail.getByRole('main');
    await expect(main.getByText(/^200\.000\s₫$/)).toBeVisible();
    await expect(main.locator('s')).toHaveText(/^250\.000\s₫$/);
    await expect(main.getByText('-20%', { exact: true })).toBeVisible();
    await detail.close();
  });

  test('AC10 hides the product: admin still lists it as Hidden, the store drops it within 60 s, and Active brings it back at the same path', async ({
    page,
    request,
  }) => {
    test.setTimeout(STORE_TEST_TIMEOUT_MS);
    const shirt = await createProduct(request, runId, { name: 'Áo thun cổ tròn' });
    created = [shirt];
    // On sale first, so what goes away below goes away because of the edit.
    await expect
      .poll(async () => (await storeStatus(shirt.slug)) === 200 && storeListHas(shirt.name), {
        timeout: STORE_DELAY_MS,
        intervals: [2_000],
      })
      .toBe(true);
    await expect
      .poll(() => sitemapHas(shirt.slug), { timeout: STORE_DELAY_MS, intervals: [2_000] })
      .toBe(true);
    await openEdit(page, shirt);

    await choose(page, 'Hidden');
    const hiddenAt = Date.now();
    await form(page).save.click();

    await expectSaved(page);
    await expect(rowOf(page, shirt.name).getByText('Hidden', { exact: true })).toBeVisible();
    await expect
      .poll(() => storeStatus(shirt.slug), { timeout: leftOf(hiddenAt), intervals: [2_000] })
      .toBe(404);
    await expect
      .poll(() => storeListHas(shirt.name), { timeout: leftOf(hiddenAt), intervals: [2_000] })
      .toBe(false);
    await expect
      .poll(() => sitemapHas(shirt.slug), { timeout: leftOf(hiddenAt), intervals: [2_000] })
      .toBe(false);

    await openEdit(page, shirt);
    await expect(page.getByRole('radio', { name: 'Hidden' })).toBeChecked();
    await choose(page, 'Active');
    const shownAt = Date.now();
    await form(page).save.click();

    await expectSaved(page);
    await expect
      .poll(() => storeStatus(shirt.slug), { timeout: leftOf(shownAt), intervals: [2_000] })
      .toBe(200);
  });

  test('AC11 sets Out of stock: within 60 s the card and the detail page of the store say "Hết hàng", and the product stays listed', async ({
    page,
    request,
  }) => {
    test.setTimeout(STORE_TEST_TIMEOUT_MS);
    const shirt = await createProduct(request, runId, { name: 'Áo thun cổ tròn' });
    created = [shirt];
    await openEdit(page, shirt);

    await choose(page, 'Out of stock');
    const savedAt = Date.now();
    await form(page).save.click();

    await expectSaved(page);
    await expect(rowOf(page, shirt.name).getByText('Out of stock', { exact: true })).toBeVisible();
    const storePage = await storeBrowser.newPage();
    const card = storePage.getByRole('main').getByRole('link').filter({ hasText: shirt.name });
    await expect
      .poll(
        async () => {
          await storePage.goto('/vi/products');
          return (await card.count()) === 1 ? card.textContent() : null;
        },
        { timeout: leftOf(savedAt), intervals: [2_000] },
      )
      .toContain('Hết hàng');
    // The detail page is cached apart from the list: it gets its own 60 s.
    const stock = storePage.getByRole('main').locator('.badge');
    await expect
      .poll(
        async () => {
          await storePage.goto(`/vi/products/${shirt.slug}`);
          // The page streams its content in after the load: wait for it, then read.
          await storePage.getByRole('heading', { level: 1, name: shirt.name }).waitFor();
          return stock.allTextContents();
        },
        { timeout: leftOf(savedAt), intervals: [2_000] },
      )
      .toContain('Hết hàng');
    await storePage.close();
  });

  test('AC12 warns at once that the old link stops working; saved, the store opens the new slug and the old one is 404', async ({
    page,
    request,
  }) => {
    test.setTimeout(STORE_TEST_TIMEOUT_MS);
    const shirt = await createProduct(request, runId, { name: 'Áo thun cổ tròn' });
    created = [shirt];
    const newSlug = `ao-thun-basic-e2e-${runId}`;
    await openEdit(page, shirt);
    const fields = form(page);
    const warning = page.getByText(`The old link /products/${shirt.slug} will stop working.`);

    await fields.slug.fill(newSlug);

    await expect(warning).toBeVisible();
    await fields.slug.fill(shirt.slug);
    await expect(warning).toHaveCount(0);
    await fields.slug.fill(newSlug);
    await expect(warning).toBeVisible();
    const savedAt = Date.now();
    await fields.save.click();

    await expectSaved(page);
    await expect(rowOf(page, shirt.name).getByText(newSlug, { exact: true })).toBeVisible();
    await expect
      .poll(() => storeStatus(newSlug), { timeout: leftOf(savedAt), intervals: [2_000] })
      .toBe(200);
    await expect
      .poll(() => storeStatus(shirt.slug), { timeout: leftOf(savedAt), intervals: [2_000] })
      .toBe(404);
  });

  test("AC13 a second tab does not overwrite the first: it sees the conflict, keeps its input, and Reload shows the first tab's version", async ({
    page,
    context,
    request,
  }) => {
    const shirt = await createProduct(request, runId, { name: 'Áo thun cổ tròn' });
    created = [shirt];
    const second = await context.newPage();
    await openEdit(page, shirt);
    await openEdit(second, shirt);
    const firstName = e2eName('Áo thun tab một', runId);
    const secondName = e2eName('Áo thun tab hai', runId);

    await form(page).name.fill(firstName);
    await form(page).save.click();
    await expectSaved(page);

    await form(second).name.fill(secondName);
    await form(second).price.fill('199000');
    await form(second).save.click();

    await expect(second.getByRole('alert')).toHaveText(
      /This product was just edited elsewhere\. Reload to see the latest version\./,
    );
    await expect(form(second).name).toHaveValue(secondName);
    await expect(form(second).price).toHaveValue('199.000');
    await expect(second).toHaveURL(new RegExp(`/products/${shirt.id}/edit$`));
    const [saved] = await findProducts(request, `e2e ${runId}`);
    expect(saved).toMatchObject({ id: shirt.id, name: firstName, price: 100000 });

    await second.getByRole('button', { name: 'Reload' }).click();

    await expect(form(second).name).toHaveValue(firstName);
    await expect(form(second).price).toHaveValue('100.000');
    await expect(second.getByRole('alert')).toHaveCount(0);
    await second.close();
  });

  test('S2.3 says the product was not found for an id no product has', async ({ page }) => {
    await page.goto('/products/019a8f2e-5b7c-7d10-9e3f-000000000000/edit');

    await expect(
      page.getByText("We couldn't find this product. It may have been deleted."),
    ).toBeVisible();
    await page.getByRole('link', { name: 'Back to products' }).click();
    await expect(page).toHaveURL(/\/products$/);
  });

  test('S2.5 offline, the save fails at once with "Couldn\'t save", keeps the input and is not sent later (NFR19)', async ({
    page,
    context,
    request,
  }) => {
    const shirt = await createProduct(request, runId, { name: 'Áo thun cổ tròn' });
    created = [shirt];
    const puts: string[] = [];
    page.on('request', (sent) => {
      if (sent.method() === 'PUT' && new URL(sent.url()).pathname === `${API}/${shirt.id}`) {
        puts.push(sent.url());
      }
    });
    await openEdit(page, shirt);
    const newName = e2eName('Áo thun ngoại tuyến', runId);
    await form(page).name.fill(newName);

    await context.setOffline(true);
    await form(page).save.click();

    await expect(page.getByRole('alert')).toHaveText("Couldn't save. Please try again.");
    await expect(form(page).save).toHaveText('Save changes');
    await expect(form(page).name).toHaveValue(newName);
    await context.setOffline(false);
    // Back online, nothing is sent on its own: the product keeps its name.
    await page.waitForTimeout(1_000);
    expect(puts.length).toBeLessThanOrEqual(1);
    expect((await findProducts(request, `e2e ${runId}`))[0]?.name).toBe(shirt.name);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`S2 in edit mode, with the slug warning and the conflict banner, has no WCAG A/AA violation in the ${colorScheme} theme`, async ({
      page,
      request,
    }) => {
      const shirt = await createProduct(request, runId, { name: 'Áo thun cổ tròn' });
      created = [shirt];
      await page.emulateMedia({ colorScheme });
      await openEdit(page, shirt);
      // Another save in between, so this one is a conflict.
      const current = (await (await request.get(`${API}/${shirt.id}`)).json()) as {
        version: number;
      };
      const response = await request.put(`${API}/${shirt.id}`, {
        data: {
          name: shirt.name,
          slug: shirt.slug,
          description: null,
          price: 120000,
          compareAtPrice: null,
          status: 'ACTIVE',
          availability: 'IN_STOCK',
          version: current.version,
        },
      });
      expect(response.status(), await response.text()).toBe(200);

      await form(page).slug.fill(`ao-thun-moi-e2e-${runId}`);
      await form(page).save.click();

      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText(/will stop working/)).toBeVisible();
      expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);
    });
  }
});
