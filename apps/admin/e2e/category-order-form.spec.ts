import AxeBuilder from '@axe-core/playwright';
import { type APIRequestContext, expect, type Locator, type Page, test } from '@playwright/test';

import {
  categoriesOfRun,
  createCategory,
  deleteCategories,
  deleteStaleE2eCategories,
  type E2eCategory,
  getCategory,
} from './support/categories';
import { deleteStaleE2eProducts, e2eName, newRunId } from './support/products';

// The display order in the category form and table of admin (docs/specs/SHOP-95/spec.md;
// Story SHOP-97): the field S2.3 and the column S1.3/S1.4 of docs/specs/SHOP-95/design.md,
// on the real api, here or on Development. AC1, AC2, AC3, AC5, and the column of AC8.
// Development is shared, so each test only compares the categories of its run, named
// `… E2E <runId>`, and deletes them when done (Architecture Decisions 10 of the plan).
// E2E of SHOP-81 have names starting with the same codes: run one criterion of this file
// with the file, as in `e2e/category-order-form.spec.ts -g "AC3"`.
test.describe.configure({ mode: 'default' });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const REQUIRED = 'Enter a display order';
const INVALID = 'Display order must be a whole number from 0 to 9999';
/** The wrong values of AC3, with the message each one shows under the field (S2.3). */
const WRONG_VALUES: [string, string][] = [
  ['', REQUIRED],
  ['-1', INVALID],
  ['10000', INVALID],
  ['1.5', INVALID],
];

const runId = newRunId();
let categories: E2eCategory[] = [];

test.beforeAll(async ({ request }) => {
  await deleteStaleE2eProducts(request);
  await deleteStaleE2eCategories(request);
});

test.afterEach(async ({ request }) => {
  // Every category of this run, made through the API or in the form.
  await deleteCategories(request, [...categories, ...(await categoriesOfRun(request, runId))]);
  categories = [];
});

async function addCategory(
  request: APIRequestContext,
  category: Parameters<typeof createCategory>[2],
): Promise<E2eCategory> {
  const made = await createCategory(request, runId, category);
  categories.push(made);
  return made;
}

function table(page: Page): Locator {
  return page.getByRole('table', { name: 'Category list' });
}

function rowOf(page: Page, name: string): Locator {
  return table(page)
    .locator('tbody tr')
    .filter({ has: page.getByText(name, { exact: true }) });
}

/** The display order cell of a row: the fifth, after the product count (S1.4). */
function orderCellOf(page: Page, name: string): Locator {
  return rowOf(page, name).getByRole('cell').nth(4);
}

/** The name and the display order of each row of this run, in the order of the table. */
async function rowsOfRun(page: Page): Promise<[string, string][]> {
  const rows = await table(page)
    .locator('tbody tr')
    .filter({ hasText: ` E2E ${runId}` })
    .all();
  return Promise.all(
    rows.map(async (row): Promise<[string, string]> => {
      const cells = row.getByRole('cell');
      return [(await cells.nth(0).innerText()).trim(), (await cells.nth(4).innerText()).trim()];
    }),
  );
}

function formFields(page: Page) {
  return {
    name: page.getByRole('textbox', { name: /Category name/ }),
    slug: page.getByRole('textbox', { name: 'URL slug' }),
    displayOrder: page.getByRole('textbox', { name: /Display order/ }),
    hidden: page.getByRole('radio', { name: 'Hidden', exact: true }),
  };
}

/** Picks Hidden as a person does, on its label: the radio is hidden under it (S2.7). */
async function chooseHidden(page: Page) {
  await page
    .locator('label')
    .filter({ has: formFields(page).hidden })
    .click();
  await expect(formFields(page).hidden).toBeChecked();
}

/**
 * Saves with each wrong value of AC3 in turn: nothing is saved, the error is under the
 * field, which is focused, and what was typed stays.
 */
async function expectEachWrongValueRefused(
  page: Page,
  save: Locator,
  kept: { name: string; hidden: boolean },
) {
  const fields = formFields(page);
  const url = page.url();
  for (const [value, message] of WRONG_VALUES) {
    await fields.displayOrder.fill(value);
    await save.click();

    await expect(page.getByText(message, { exact: true }), `display order ${value}`).toBeVisible();
    await expect(fields.displayOrder).toHaveAttribute('aria-invalid', 'true');
    await expect(fields.displayOrder).toBeFocused();
    await expect(fields.displayOrder).toHaveValue(value);
    await expect(fields.name).toHaveValue(kept.name);
    if (kept.hidden) await expect(fields.hidden).toBeChecked();
    expect(page.url()).toBe(url);
  }
}

test('AC1 starts the add form at 0, and lists a category added with 5 as 5, one left at 0 as 0', async ({
  page,
}) => {
  const gloves = e2eName('Bao tay', runId);
  const sandals = e2eName('Dép', runId);
  await page.goto('/categories');
  await page.getByRole('link', { name: 'Add category' }).click();
  const fields = formFields(page);

  await expect(fields.displayOrder).toHaveValue('0');
  await fields.name.fill(gloves);
  await fields.displayOrder.fill('5');
  await page.getByRole('button', { name: 'Add category' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'Category added' })).toBeVisible();
  await expect(page).toHaveURL(/\/categories$/);
  await expect(orderCellOf(page, gloves)).toHaveText('5');

  await page.getByRole('link', { name: 'Add category' }).click();
  await expect(fields.displayOrder).toHaveValue('0');
  await fields.name.fill(sandals);
  await page.getByRole('button', { name: 'Add category' }).click();

  await expect(page).toHaveURL(/\/categories$/);
  await expect(orderCellOf(page, sandals)).toHaveText('0');
});

test('AC2 shows the saved 0 in the edit form, saves 3, and keeps the name, slug and status', async ({
  page,
  request,
}) => {
  const shirts = await addCategory(request, { name: 'Áo', displayOrder: 0, status: 'HIDDEN' });
  await page.goto('/categories');
  const fields = formFields(page);

  await page.getByRole('link', { name: `Edit ${shirts.name}` }).click();
  await expect(fields.displayOrder).toHaveValue('0');
  await fields.displayOrder.fill('3');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'Category saved' })).toBeVisible();
  await expect(page).toHaveURL(/\/categories$/);
  await expect(orderCellOf(page, shirts.name)).toHaveText('3');

  await page.getByRole('link', { name: `Edit ${shirts.name}` }).click();
  await expect(fields.displayOrder).toHaveValue('3');
  await expect(fields.name).toHaveValue(shirts.name);
  await expect(fields.slug).toHaveValue(shirts.slug);
  await expect(fields.hidden).toBeChecked();
  expect(await getCategory(request, shirts.id)).toMatchObject({
    name: shirts.name,
    slug: shirts.slug,
    status: 'HIDDEN',
    displayOrder: 3,
  });
});

test('AC3 does not add with an empty, -1, 10000 or 1.5 display order, then adds with 9999', async ({
  page,
  request,
}) => {
  const gloves = e2eName('Bao tay', runId);
  await page.goto('/categories/new');
  const fields = formFields(page);
  const save = page.getByRole('button', { name: 'Add category' });
  await fields.name.fill(gloves);
  await chooseHidden(page);

  await expectEachWrongValueRefused(page, save, { name: gloves, hidden: true });
  expect(await categoriesOfRun(request, runId)).toEqual([]);

  await fields.displayOrder.fill('9999');
  await save.click();

  await expect(page).toHaveURL(/\/categories$/);
  await expect(orderCellOf(page, gloves)).toHaveText('9999');
  expect(
    (await categoriesOfRun(request, runId)).map(({ name, status, displayOrder }) => ({
      name,
      status,
      displayOrder,
    })),
  ).toEqual([{ name: gloves, status: 'HIDDEN', displayOrder: 9999 }]);
});

test('AC3 does not add with 1.5 and adds with 0 once corrected', async ({ page, request }) => {
  const gloves = e2eName('Bao tay', runId);
  await page.goto('/categories/new');
  const fields = formFields(page);
  await fields.name.fill(gloves);
  await fields.displayOrder.fill('1.5');
  await page.getByRole('button', { name: 'Add category' }).click();
  await expect(page.getByText(INVALID, { exact: true })).toBeVisible();

  await fields.displayOrder.fill('0');
  await page.getByRole('button', { name: 'Add category' }).click();

  await expect(page).toHaveURL(/\/categories$/);
  await expect(orderCellOf(page, gloves)).toHaveText('0');
  expect((await categoriesOfRun(request, runId)).map(({ displayOrder }) => displayOrder)).toEqual([
    0,
  ]);
});

test('AC3 does not save an edit with an empty, -1, 10000 or 1.5 display order, then saves 0 and 9999', async ({
  page,
  request,
}) => {
  const shirts = await addCategory(request, { name: 'Áo', displayOrder: 5 });
  const renamed = e2eName('Áo nam', runId);
  await page.goto(`/categories/${shirts.id}/edit`);
  const fields = formFields(page);
  const save = page.getByRole('button', { name: 'Save changes' });
  await expect(fields.displayOrder).toHaveValue('5');
  await fields.name.fill(renamed);

  await expectEachWrongValueRefused(page, save, { name: renamed, hidden: false });
  expect(await getCategory(request, shirts.id)).toMatchObject({
    name: shirts.name,
    displayOrder: 5,
    version: shirts.version,
  });

  await fields.displayOrder.fill('0');
  await save.click();
  await expect(page).toHaveURL(/\/categories$/);
  await expect(orderCellOf(page, renamed)).toHaveText('0');

  await page.getByRole('link', { name: `Edit ${renamed}` }).click();
  await fields.displayOrder.fill('9999');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page).toHaveURL(/\/categories$/);
  await expect(orderCellOf(page, renamed)).toHaveText('9999');
  expect(await getCategory(request, shirts.id)).toMatchObject({
    name: renamed,
    displayOrder: 9999,
  });
});

test('AC5 lists the categories by display order then name, and moves "Áo" first once set to 0', async ({
  page,
  request,
}) => {
  // Added in neither order; "Đầm" hidden, still in the table at its place.
  const dresses = await addCategory(request, { name: 'Đầm', displayOrder: 1, status: 'HIDDEN' });
  const shirts = await addCategory(request, { name: 'Áo', displayOrder: 2 });
  const trousers = await addCategory(request, { name: 'Quần', displayOrder: 0 });
  const gloves = await addCategory(request, { name: 'Bao tay', displayOrder: 1 });

  await page.goto('/categories');
  await expect(rowOf(page, gloves.name)).toBeVisible();
  expect(await rowsOfRun(page)).toEqual([
    [trousers.name, '0'],
    [gloves.name, '1'],
    [dresses.name, '1'],
    [shirts.name, '2'],
  ]);

  await page.getByRole('link', { name: `Edit ${shirts.name}` }).click();
  await formFields(page).displayOrder.fill('0');
  await page.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.getByRole('status').filter({ hasText: 'Category saved' })).toBeVisible();
  await expect
    .poll(() => rowsOfRun(page))
    .toEqual([
      [shirts.name, '0'],
      [trousers.name, '0'],
      [gloves.name, '1'],
      [dresses.name, '1'],
    ]);
});

test('AC8 shows 0 in the display order column for three categories added without one', async ({
  page,
  request,
}) => {
  // Added through the API without a display order, in the reverse order of their names.
  const trousers = await addCategory(request, { name: 'Quần' });
  const gloves = await addCategory(request, { name: 'Bao tay' });
  const jackets = await addCategory(request, { name: 'Áo khoác' });

  await page.goto('/categories');
  await expect(rowOf(page, trousers.name)).toBeVisible();

  expect(await rowsOfRun(page)).toEqual([
    [jackets.name, '0'],
    [gloves.name, '0'],
    [trousers.name, '0'],
  ]);
});

test.describe('accessibility of S1 and S2 with the display order', () => {
  for (const language of ['en', 'vi'] as const) {
    test(`S1 and S2 have no WCAG A/AA violation in ${language}, the display order field with an error too`, async ({
      page,
      request,
    }) => {
      const shirts = await addCategory(request, { name: 'Áo', displayOrder: 1000 });
      await page.goto('/categories');
      // The browser starts in English; the choice is kept for the next page.
      await page.getByLabel('Language').selectOption(language);
      // The table is named in the language picked: find the row by the name of the category.
      const row = page
        .getByRole('row')
        .filter({ has: page.getByText(shirts.name, { exact: true }) });
      await expect(row.getByRole('cell').nth(4)).toHaveText('1000');

      expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);

      await page.goto(`/categories/${shirts.id}/edit`);
      const field = page.getByRole('textbox', {
        name: language === 'vi' ? /Thứ tự hiển thị/ : /Display order/,
      });
      await expect(field).toHaveValue('1000');

      expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);

      await field.fill('1.5');
      await page
        .getByRole('button', { name: language === 'vi' ? 'Lưu thay đổi' : 'Save changes' })
        .click();
      await expect(field).toHaveAttribute('aria-invalid', 'true');

      expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);
    });
  }
});
