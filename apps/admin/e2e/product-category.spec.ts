import { type APIRequestContext, expect, type Locator, type Page, test } from '@playwright/test';

import {
  categoriesOfRun,
  createCategory,
  deleteCategories,
  deleteStaleE2eCategories,
  type E2eCategory,
} from './support/categories';
import {
  createProduct,
  deleteProducts,
  deleteStaleE2eProducts,
  type E2eProduct,
  e2eName,
  findProducts,
  getProduct,
  newRunId,
} from './support/products';

// US2 of docs/specs/SHOP-81/spec.md: S4 of docs/specs/SHOP-81/design.md, the Category
// field of the product form, against the real api, here or on Development. Each test
// makes its categories and products through the API, named `… E2E <runId>`, and
// deletes them. The part of AC9 on the store, "within 60 seconds", is tested by the
// Story of user (plan, Architecture Decisions 3).
test.describe.configure({ mode: 'default' });

const runId = newRunId();
let categories: E2eCategory[] = [];
let products: E2eProduct[] = [];

test.beforeAll(async ({ request }) => {
  await deleteStaleE2eProducts(request);
  await deleteStaleE2eCategories(request);
});

test.afterEach(async ({ request }) => {
  await deleteProducts(request, [...products, ...(await findProducts(request, `e2e ${runId}`))]);
  await deleteCategories(request, [...categories, ...(await categoriesOfRun(request, runId))]);
  categories = [];
  products = [];
});

async function addCategory(
  request: APIRequestContext,
  category: Parameters<typeof createCategory>[2],
): Promise<E2eCategory> {
  const made = await createCategory(request, runId, category);
  categories.push(made);
  return made;
}

function categoryField(page: Page): Locator {
  return page.getByRole('combobox', { name: 'Category' });
}

/** The options of the field that belong to this run, with No category, in their order. */
async function optionsOfRun(page: Page): Promise<string[]> {
  const texts = await categoryField(page).locator('option').allInnerTexts();
  return texts.filter((text) => text === 'No category' || text.includes(` E2E ${runId}`));
}

async function productCountOf(page: Page, name: string): Promise<string> {
  await page.goto('/categories');
  const row = page
    .getByRole('table', { name: 'Category list' })
    .locator('tbody tr')
    .filter({ has: page.getByText(name, { exact: true }) });
  return (await row.getByRole('cell').nth(3).innerText()).trim();
}

test.describe('US2 the Category field of the product form S4', () => {
  test('AC9 starts at No category and lists the categories by name, Hidden in its text', async ({
    page,
    request,
  }) => {
    // Made in the reverse order of their names: the field follows the names.
    const accessories = await addCategory(request, { name: 'Phụ kiện', status: 'HIDDEN' });
    const shirts = await addCategory(request, { name: 'Áo' });

    await page.goto('/products/new');

    await expect(categoryField(page)).toBeEnabled();
    await expect(categoryField(page)).toHaveValue('');
    expect(await optionsOfRun(page)).toEqual([
      'No category',
      shirts.name,
      `${accessories.name} (Hidden)`,
    ]);
    expect((await categoryField(page).locator('option').allInnerTexts())[0]).toBe('No category');
  });

  test('AC9 lists a category added in another tab once the field is opened, without a reload', async ({
    context,
    page,
  }) => {
    const shirts = e2eName('Áo', runId);
    await page.goto('/products/new');
    await expect(categoryField(page)).toBeEnabled();
    expect(await optionsOfRun(page)).toEqual(['No category']);

    // Another tab of the same admin adds a category through its form.
    const other = await context.newPage();
    await other.goto('/categories/new');
    await other.getByRole('textbox', { name: /Category name/ }).fill(shirts);
    await other.getByRole('button', { name: 'Add category' }).click();
    await expect(other.getByRole('status').filter({ hasText: 'Category added' })).toBeVisible();
    await other.close();

    await page.bringToFront();
    await categoryField(page).click();

    await expect.poll(() => optionsOfRun(page)).toEqual(['No category', shirts]);
    await categoryField(page).selectOption({ label: shirts });
    await expect(categoryField(page).locator('option:checked')).toHaveText(shirts);
  });

  test('AC9 adds a product to a category, its count goes up by 1, and No category takes it out again', async ({
    page,
    request,
  }) => {
    const shirts = await addCategory(request, { name: 'Áo' });
    await addCategory(request, { name: 'Phụ kiện', status: 'HIDDEN' });
    expect(await productCountOf(page, shirts.name)).toBe('0');
    const name = e2eName('Áo thun cổ tròn', runId);

    await page.goto('/products/new');
    await page.getByRole('textbox', { name: /Product name/ }).fill(name);
    await page.getByRole('textbox', { name: /^Price/ }).fill('200000');
    await categoryField(page).selectOption({ label: shirts.name });
    await page.getByRole('button', { name: 'Add product' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Product added' })).toBeVisible();
    const [tee] = await findProducts(request, name);
    if (tee === undefined) throw new Error('the product was not added');
    products.push(tee);
    expect(await getProduct(request, tee.id)).toMatchObject({
      status: 'ACTIVE',
      categoryId: shirts.id,
    });
    expect(await productCountOf(page, shirts.name)).toBe('1');

    await page.goto(`/products/${tee.id}/edit`);
    await expect(categoryField(page)).toHaveValue(shirts.id);
    await categoryField(page).selectOption({ label: 'No category' });
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Product saved' })).toBeVisible();

    await page.goto(`/products/${tee.id}/edit`);
    await expect(categoryField(page)).toBeEnabled();
    await expect(categoryField(page)).toHaveValue('');
    await expect(categoryField(page).locator('option:checked')).toHaveText('No category');
    expect((await getProduct(request, tee.id)).categoryId).toBeNull();
    expect(await productCountOf(page, shirts.name)).toBe('0');
  });

  test('AC10 a category deleted in another tab: nothing saved, the error under the field, what was typed kept', async ({
    page,
    request,
  }) => {
    const accessories = await addCategory(request, { name: 'Phụ kiện' });
    const scarf = await createProduct(request, runId, { name: 'Khăn lụa' });
    products.push(scarf);
    await page.goto(`/products/${scarf.id}/edit`);
    await expect(categoryField(page)).toBeEnabled();
    const nameField = page.getByRole('textbox', { name: /Product name/ });
    const renamed = e2eName('Khăn lụa tơ tằm', runId);
    await nameField.fill(renamed);
    await categoryField(page).selectOption({ label: accessories.name });

    // Another tab deletes the category.
    await deleteCategories(request, [accessories]);
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(categoryField(page)).toHaveAccessibleDescription(
      /^This category no longer exists\. Pick another one\./,
    );
    await expect(categoryField(page)).toBeFocused();
    await expect(categoryField(page)).toHaveValue('');
    await expect(page).toHaveURL(new RegExp(`/products/${scarf.id}/edit$`));
    await expect(nameField).toHaveValue(renamed);
    expect(await optionsOfRun(page)).toEqual(['No category']);
    const saved = await getProduct(request, scarf.id);
    expect(saved).toMatchObject({ name: scarf.name, categoryId: null });
  });

  test('AC10 the api answers 400 Problem Details on categoryId for a category that does not exist, and saves nothing', async ({
    request,
  }) => {
    const scarf = await createProduct(request, runId, { name: 'Khăn lụa' });
    products.push(scarf);
    const before = await getProduct(request, scarf.id);
    const unknown = '019a9c41-2b3d-7e10-8f2a-0000000000ff';
    const body = {
      name: e2eName('Khăn lụa mới', runId),
      slug: null,
      description: null,
      price: 150000,
      compareAtPrice: null,
      status: 'ACTIVE',
      availability: 'IN_STOCK',
      categoryId: unknown,
    };

    for (const response of [
      await request.post('/api/admin/products', { data: body }),
      await request.put(`/api/admin/products/${scarf.id}`, {
        data: { ...body, slug: scarf.slug, version: before.version },
      }),
    ]) {
      expect(response.status()).toBe(400);
      expect(response.headers()['content-type']).toContain('application/problem+json');
      const problem = (await response.json()) as { code: string; errors: { field: string }[] };
      expect(problem.code).toBe('VALIDATION_FAILED');
      expect(problem.errors.map((error) => error.field)).toEqual(['categoryId']);
    }

    expect(await findProducts(request, `e2e ${runId}`)).toHaveLength(1);
    expect(await getProduct(request, scarf.id)).toEqual(before);
  });

  test('NFR10 shows a category name with markup as the text of its option, and runs no script', async ({
    page,
    request,
  }) => {
    const scripts: string[] = [];
    page.on('dialog', (dialog) => {
      scripts.push(dialog.message());
      void dialog.dismiss();
    });
    const tricky = await addCategory(request, { name: '</script><script>alert(1)</script>' });

    await page.goto('/products/new');
    await expect(categoryField(page)).toBeEnabled();

    await expect(categoryField(page).getByRole('option', { name: tricky.name })).toHaveCount(1);
    expect(scripts).toEqual([]);
    expect(await page.locator('main script').count()).toBe(0);
  });
});
