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
import { isLocal } from './support/env';
import {
  createProduct,
  deleteProducts,
  deleteStaleE2eProducts,
  type E2eProduct,
  e2eName,
  e2eNameOfLength,
  findProducts,
  getProduct,
  newRunId,
} from './support/products';

// US1 of docs/specs/SHOP-81/spec.md: S1, S2 and S3 of docs/specs/SHOP-81/design.md
// against the real api, here or on Development. Each test makes its categories and
// products through the API, named `… E2E <runId>`, checks only those, and deletes them.
// The parts of AC5–AC8 on the store, "within 60 seconds", are tested by the Story of
// user, which makes the same changes through the admin API (plan, Architecture
// Decisions 3). The tests of a file run one after the other.
test.describe.configure({ mode: 'default' });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const API = '/api/admin/categories';

const runId = newRunId();
let categories: E2eCategory[] = [];
let products: E2eProduct[] = [];

test.beforeAll(async ({ request }) => {
  await deleteStaleE2eProducts(request);
  await deleteStaleE2eCategories(request);
});

test.afterEach(async ({ request }) => {
  // Products first, then every category of this run, deleted or made in the form: the
  // api answers 204 for one already gone.
  await deleteProducts(request, [...products, ...(await findProducts(request, `e2e ${runId}`))]);
  await deleteCategories(request, [...categories, ...(await categoriesOfRun(request, runId))]);
  categories = [];
  products = [];
});

/** The slug the api generates from `<name> E2E <runId>`, `base` being that of `<name>`. */
const e2eSlug = (base: string) => `${base}-e2e-${runId}`;

function table(page: Page): Locator {
  return page.getByRole('table', { name: 'Category list' });
}

function rowOf(page: Page, name: string): Locator {
  return table(page)
    .locator('tbody tr')
    .filter({ has: page.getByText(name, { exact: true }) });
}

/**
 * The cells of the row of a category: name, slug, status, product count, then the
 * actions. Retried until the list shows them, as it reloads after a save.
 */
async function expectCells(row: Locator, cells: string[]): Promise<void> {
  await expect(row.getByRole('cell')).toHaveText([...cells, /Edit/]);
}

/**
 * Picks an option of S2.7 as a person does, on its label: the radio itself is hidden
 * under the label of the segmented control.
 */
async function choose(page: Page, option: 'Visible' | 'Hidden') {
  await page
    .locator('label')
    .filter({ has: page.getByRole('radio', { name: option, exact: true }) })
    .click();
  await expect(page.getByRole('radio', { name: option, exact: true })).toBeChecked();
}

async function addCategory(
  request: APIRequestContext,
  category: Parameters<typeof createCategory>[2],
): Promise<E2eCategory> {
  const made = await createCategory(request, runId, category);
  categories.push(made);
  return made;
}

async function addProduct(
  request: APIRequestContext,
  product: Parameters<typeof createProduct>[2],
): Promise<E2eProduct> {
  const made = await createProduct(request, runId, product);
  products.push(made);
  return made;
}

function formFields(page: Page) {
  return {
    name: page.getByRole('textbox', { name: /Category name/ }),
    slug: page.getByRole('textbox', { name: 'URL slug' }),
  };
}

test.describe('US1 the category list S1', () => {
  test('AC1 lists the categories by name, each with its slug, status and product count', async ({
    page,
    request,
  }) => {
    // Made in the reverse order of their names: the list follows the names.
    const accessories = await addCategory(request, { name: 'Phụ kiện', status: 'HIDDEN' });
    const shirts = await addCategory(request, { name: 'Áo' });
    for (const name of ['Áo thun', 'Áo len', 'Áo sơ mi']) {
      await addProduct(request, { name, categoryId: shirts.id, status: 'ACTIVE' });
    }

    await page.goto('/categories');

    await expect(page.getByRole('heading', { level: 1, name: 'Categories' })).toBeVisible();
    await expect(rowOf(page, shirts.name)).toBeVisible();
    await expect(rowOf(page, accessories.name)).toBeVisible();
    const names = await table(page).locator('tbody tr .table__name').allInnerTexts();
    const ofRun = names.filter((name) => name.endsWith(` E2E ${runId}`));
    expect(ofRun).toEqual([shirts.name, accessories.name]);
    await expectCells(rowOf(page, shirts.name), [shirts.name, shirts.slug, 'Visible', '3']);
    await expectCells(rowOf(page, accessories.name), [
      accessories.name,
      accessories.slug,
      'Hidden',
      '0',
    ]);
  });

  test('AC1 says "No categories yet." with Add category when there is none @local', async ({
    page,
    baseURL,
  }) => {
    test.skip(!isLocal(baseURL), 'reason: mocks the category list, local apps only');
    // reason: the E2E files run side by side and make categories of their own, so the
    // database here is never sure to be empty while this test runs: the list the api
    // returns is replaced by an empty one, in this browser only.
    await page.route(`**${API}`, (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ json: { items: [] } })
        : route.fallback(),
    );

    await page.goto('/categories');

    await expect(table(page).getByRole('status')).toHaveText('No categories yet.');
    await expect(page.getByRole('link', { name: 'Add category' })).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Add category' })).toBeVisible();
  });

  test('marks Categories as the current page of the navigation (S1.1)', async ({ page }) => {
    await page.goto('/categories');

    await expect(
      page
        .getByRole('navigation', { name: 'Main navigation' })
        .getByRole('link', { name: 'Categories' }),
    ).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('US1 the category form S2', () => {
  test('AC2 fills the slug from the name, saves, and lists the category as Visible with 0 products', async ({
    page,
  }) => {
    const name = e2eName('Áo khoác nữ', runId);
    await page.goto('/categories');
    await page.getByRole('link', { name: 'Add category' }).click();
    const fields = formFields(page);

    await fields.name.fill(name);

    await expect(fields.slug).toHaveValue(e2eSlug('ao-khoac-nu'));
    await page.getByRole('button', { name: 'Add category' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Category added' })).toBeVisible();
    await expect(page).toHaveURL(/\/categories$/);
    await expectCells(rowOf(page, name), [name, e2eSlug('ao-khoac-nu'), 'Visible', '0']);
  });

  const invalidValues: [string, { name?: string; slug?: string }, 'name' | 'slug', string][] = [
    ['an empty name', { name: '' }, 'name', 'Enter a category name'],
    ['a name of white space only', { name: '   ' }, 'name', 'Enter a category name'],
    ['a name of 61 characters', { name: e2eNameOfLength(61, runId) }, 'name', 'Name must be 60'],
    ['a slug with capitals', { slug: 'Ao-Khoac' }, 'slug', 'Use lowercase a–z'],
    ['a slug with accents', { slug: 'áo-khoác' }, 'slug', 'Use lowercase a–z'],
    ['a slug with a space', { slug: 'ao khoac' }, 'slug', 'Use lowercase a–z'],
    ['a slug with a hyphen at the start', { slug: '-ao-khoac' }, 'slug', 'Use lowercase a–z'],
  ];

  for (const [label, values, field, message] of invalidValues) {
    test(`AC3 does not add ${label}: the error is under the field, and what was typed stays`, async ({
      page,
      request,
    }) => {
      const typed = { name: values.name ?? e2eName('Áo khoác', runId), slug: values.slug };
      await page.goto('/categories/new');
      const fields = formFields(page);
      await fields.name.fill(typed.name);
      if (typed.slug !== undefined) await fields.slug.fill(typed.slug);

      await page.getByRole('button', { name: 'Add category' }).click();

      const input = fields[field];
      await expect(input).toHaveAttribute('aria-invalid', 'true');
      await expect(input).toHaveAccessibleDescription(new RegExp(`^${message}`));
      await expect(input).toBeFocused();
      await expect(fields.name).toHaveValue(typed.name);
      if (typed.slug !== undefined) await expect(fields.slug).toHaveValue(typed.slug);
      await expect(page).toHaveURL(/\/categories\/new$/);
      expect(await categoriesOfRun(request, runId)).toEqual([]);
    });
  }

  test('AC3 does not save an edit with an invalid name or slug, and keeps what was typed', async ({
    page,
    request,
  }) => {
    const shirts = await addCategory(request, { name: 'Áo' });
    await page.goto(`/categories/${shirts.id}/edit`);
    const fields = formFields(page);
    await expect(fields.name).toHaveValue(shirts.name);

    await fields.name.fill('   ');
    await fields.slug.fill('Ao Nam');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(fields.name).toHaveAccessibleDescription(/^Enter a category name/);
    await expect(fields.slug).toHaveAccessibleDescription(/^Use lowercase a–z/);
    await expect(fields.name).toBeFocused();
    await expect(fields.slug).toHaveValue('Ao Nam');
    const saved = await getCategory(request, shirts.id);
    expect(saved).toMatchObject({ name: shirts.name, slug: shirts.slug, version: shirts.version });
  });

  test('AC3 the api answers 400 Problem Details naming each invalid field, and saves nothing', async ({
    request,
  }) => {
    const shirts = await addCategory(request, { name: 'Áo' });
    const bodies = [
      { name: '', slug: 'Ao', status: 'VISIBLE' },
      { name: '   ', slug: 'áo', status: 'VISIBLE' },
      { name: e2eNameOfLength(61, runId), slug: 'ao thun', status: 'VISIBLE' },
      { name: e2eNameOfLength(61, runId), slug: '-ao', status: 'VISIBLE' },
    ];

    for (const body of bodies) {
      for (const send of [
        () => request.post(API, { data: body }),
        () => request.put(`${API}/${shirts.id}`, { data: { ...body, version: shirts.version } }),
      ]) {
        const response = await send();
        expect(response.status()).toBe(400);
        expect(response.headers()['content-type']).toContain('application/problem+json');
        const problem = (await response.json()) as { code: string; errors: { field: string }[] };
        expect(problem.code).toBe('VALIDATION_FAILED');
        expect(new Set(problem.errors.map((error) => error.field))).toEqual(
          new Set(['name', 'slug']),
        );
      }
    }

    expect((await categoriesOfRun(request, runId)).map((item) => item.id)).toEqual([shirts.id]);
    expect(await getCategory(request, shirts.id)).toMatchObject({
      name: shirts.name,
      slug: shirts.slug,
      version: shirts.version,
    });
  });

  test('AC4 refuses a name already taken, in any case, under the name', async ({
    page,
    request,
  }) => {
    await addCategory(request, { name: 'Áo thun' });
    await page.goto('/categories/new');
    const fields = formFields(page);

    await fields.name.fill(e2eName('Áo Thun', runId));
    await page.getByRole('button', { name: 'Add category' }).click();

    await expect(fields.name).toHaveAccessibleDescription(/^This category name already exists/);
    await expect(fields.name).toBeFocused();
    expect(await categoriesOfRun(request, runId)).toHaveLength(1);
  });

  test('AC4 adds -2 to a slug made from the name when it is taken', async ({ page, request }) => {
    const tee = await addCategory(request, { name: 'Áo thun' });
    await page.goto('/categories/new');
    const name = e2eName('Ao thun', runId);

    await formFields(page).name.fill(name);
    await page.getByRole('button', { name: 'Add category' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Category added' })).toBeVisible();
    await expectCells(rowOf(page, name), [name, `${tee.slug}-2`, 'Visible', '0']);
  });

  test('AC4 refuses a typed slug already in use, under the slug, and saves nothing', async ({
    page,
    request,
  }) => {
    const tee = await addCategory(request, { name: 'Áo thun' });
    await page.goto('/categories/new');
    const fields = formFields(page);

    await fields.name.fill(e2eName('Áo cộc', runId));
    await fields.slug.fill(tee.slug);
    await page.getByRole('button', { name: 'Add category' }).click();

    await expect(fields.slug).toHaveAccessibleDescription(/^This slug is already in use/);
    await expect(page).toHaveURL(/\/categories\/new$/);
    expect(await categoriesOfRun(request, runId)).toHaveLength(1);
  });

  test('AC5 keeps the slug when the name changes, warns when the slug changes, and saves the new slug', async ({
    page,
    request,
  }) => {
    const shirts = await addCategory(request, { name: 'Áo' });
    await addProduct(request, { name: 'Áo thun cổ tròn', categoryId: shirts.id, status: 'ACTIVE' });
    await page.goto('/categories');
    await page.getByRole('link', { name: `Edit ${shirts.name}` }).click();
    const fields = formFields(page);
    await expect(fields.slug).toHaveAccessibleDescription(/Renaming doesn't change the link\./);
    const renamed = e2eName('Áo nam', runId);

    await fields.name.fill(renamed);
    await expect(fields.slug).toHaveValue(shirts.slug);
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Category saved' })).toBeVisible();
    await expectCells(rowOf(page, renamed), [renamed, shirts.slug, 'Visible', '1']);

    await page.getByRole('link', { name: `Edit ${renamed}` }).click();
    await fields.slug.fill(`${shirts.slug}-nam`);
    await expect(fields.slug).toHaveAccessibleDescription(
      new RegExp(`^The old link /categories/${shirts.slug} will stop working\\.`),
    );
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Category saved' })).toBeVisible();
    await expectCells(rowOf(page, renamed), [renamed, `${shirts.slug}-nam`, 'Visible', '1']);
    expect(await getCategory(request, shirts.id)).toMatchObject({ slug: `${shirts.slug}-nam` });
  });

  test('AC6 keeps a hidden category in admin, labelled Hidden, and Visible again once shown', async ({
    page,
    request,
  }) => {
    const shirts = await addCategory(request, { name: 'Áo' });
    await addProduct(request, { name: 'Áo thun cổ tròn', categoryId: shirts.id, status: 'ACTIVE' });

    for (const label of ['Hidden', 'Visible'] as const) {
      await page.goto(`/categories/${shirts.id}/edit`);
      await expect(formFields(page).name).toHaveValue(shirts.name);
      await choose(page, label);
      await page.getByRole('button', { name: 'Save changes' }).click();

      await expect(page.getByRole('status').filter({ hasText: 'Category saved' })).toBeVisible();
      await expectCells(rowOf(page, shirts.name), [shirts.name, shirts.slug, label, '1']);
    }
  });
});

test.describe('US1 the delete dialog S3', () => {
  test('AC7 names the category, says it cannot be undone, suggests Hidden, and Cancel keeps it', async ({
    page,
    request,
  }) => {
    const accessories = await addCategory(request, { name: 'Phụ kiện' });
    await page.goto('/categories');
    const deleteButton = page.getByRole('button', { name: `Delete ${accessories.name}` });

    await deleteButton.click();

    const dialog = page.getByRole('alertdialog', { name: `Delete “${accessories.name}”?` });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog).toHaveAccessibleDescription(
      "This can't be undone. To hide the category for now, set its status to Hidden when you edit it.",
    );
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(dialog).toBeHidden();
    await expect(deleteButton).toBeFocused();
    await expect(rowOf(page, accessories.name)).toBeVisible();
    expect(await getCategory(request, accessories.id)).not.toBeNull();
  });

  test('AC7 Esc acts as Cancel, and Tab stays in the dialog', async ({ page, request }) => {
    const accessories = await addCategory(request, { name: 'Phụ kiện' });
    await page.goto('/categories');
    const deleteButton = page.getByRole('button', { name: `Delete ${accessories.name}` });
    await deleteButton.click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();

    for (const name of ['Delete', 'Close', 'Cancel']) {
      await page.keyboard.press('Tab');
      await expect(dialog.getByRole('button', { name, exact: true })).toBeFocused();
    }
    await page.keyboard.press('Escape');

    await expect(dialog).toBeHidden();
    await expect(deleteButton).toBeFocused();
  });

  test('AC7 deletes a category with no product: "Category deleted", gone from admin, and its slug free again', async ({
    page,
    request,
  }) => {
    const accessories = await addCategory(request, { name: 'Phụ kiện' });
    await page.goto('/categories');

    await page.getByRole('button', { name: `Delete ${accessories.name}` }).click();
    await page
      .getByRole('alertdialog', { name: `Delete “${accessories.name}”?` })
      .getByRole('button', { name: 'Delete', exact: true })
      .click();

    await expect(page.getByRole('status').filter({ hasText: 'Category deleted' })).toBeVisible();
    await expect(page.getByRole('alertdialog')).toBeHidden();
    await expect(rowOf(page, accessories.name)).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Category list' })).toBeFocused();
    expect(await getCategory(request, accessories.id)).toBeNull();
    // The slug is free again for a new category.
    const again = await addCategory(request, { name: 'Phụ kiện mới', slug: accessories.slug });
    expect(again.slug).toBe(accessories.slug);
  });

  test('AC8 says how many products become No category, deletes the category, and keeps both products as they were', async ({
    page,
    request,
  }) => {
    const shirts = await addCategory(request, { name: 'Áo' });
    const tee = await addProduct(request, {
      name: 'Áo thun cổ tròn',
      categoryId: shirts.id,
      status: 'ACTIVE',
      price: 200000,
    });
    const sweater = await addProduct(request, {
      name: 'Áo len',
      categoryId: shirts.id,
      status: 'HIDDEN',
      availability: 'OUT_OF_STOCK',
      price: 450000,
    });
    const before = await Promise.all([
      getProduct(request, tee.id),
      getProduct(request, sweater.id),
    ]);
    await page.goto('/categories');

    await page.getByRole('button', { name: `Delete ${shirts.name}` }).click();
    const dialog = page.getByRole('alertdialog', { name: `Delete “${shirts.name}”?` });
    await expect(dialog).toHaveAccessibleDescription(
      "This can't be undone. 2 products in this category will become No category. To hide the category for now, set its status to Hidden when you edit it.",
    );
    await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

    await expect(page.getByRole('status').filter({ hasText: 'Category deleted' })).toBeVisible();
    await expect(rowOf(page, shirts.name)).toHaveCount(0);
    const after = await Promise.all([getProduct(request, tee.id), getProduct(request, sweater.id)]);
    // Only the category changes, and updated_at with it (plan, Database Changes): the
    // name, slug, price, status, availability and version stay.
    const kept = (product: (typeof after)[number]) => ({
      name: product.name,
      slug: product.slug,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      status: product.status,
      availability: product.availability,
      description: product.description,
      version: product.version,
    });
    expect(before.map((product) => product.categoryId)).toEqual([shirts.id, shirts.id]);
    expect(after.map((product) => product.categoryId)).toEqual([null, null]);
    expect(after.map(kept)).toEqual(before.map(kept));
    // In admin too: the edit form of each shows No category.
    for (const product of [tee, sweater]) {
      await page.goto(`/products/${product.id}/edit`);
      await expect(page.getByRole('combobox', { name: 'Category' })).toBeEnabled();
      await expect(page.getByRole('combobox', { name: 'Category' })).toHaveValue('');
      await expect(
        page.getByRole('combobox', { name: 'Category' }).locator('option:checked'),
      ).toHaveText('No category');
    }
  });
});

test.describe('NFR10 a category name with markup', () => {
  test('shows as text in the table, the labels of its buttons and the dialog, and runs no script', async ({
    page,
    request,
  }) => {
    const scripts: string[] = [];
    page.on('dialog', (dialog) => {
      scripts.push(dialog.message());
      void dialog.dismiss();
    });
    const tricky = await addCategory(request, { name: '</script><script>alert(1)</script>' });
    await page.goto('/categories');

    await expect(rowOf(page, tricky.name)).toBeVisible();
    await page.getByRole('button', { name: `Delete ${tricky.name}` }).click();
    await expect(page.getByRole('alertdialog', { name: `Delete “${tricky.name}”?` })).toBeVisible();
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await expect(page.getByRole('status').filter({ hasText: 'Category deleted' })).toBeVisible();

    expect(scripts).toEqual([]);
    expect(await page.locator('main script').count()).toBe(0);
  });
});

test.describe('accessibility of S1, S2 and S3', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`S1 and S3 have no WCAG A/AA violation in the ${colorScheme} theme`, async ({
      page,
      request,
    }) => {
      const shirts = await addCategory(request, { name: 'Áo' });
      await addProduct(request, { name: 'Áo thun', categoryId: shirts.id });
      await addCategory(request, { name: 'Phụ kiện', status: 'HIDDEN' });
      await page.emulateMedia({ colorScheme });
      await page.goto('/categories');
      await expect(rowOf(page, shirts.name)).toBeVisible();

      expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);

      await page.getByRole('button', { name: `Delete ${shirts.name}` }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();

      expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);
    });

    test(`S2 has no WCAG A/AA violation in the ${colorScheme} theme, with errors and the slug warning`, async ({
      page,
      request,
    }) => {
      const shirts = await addCategory(request, { name: 'Áo' });
      await page.emulateMedia({ colorScheme });
      await page.goto('/categories/new');
      await expect(formFields(page).name).toBeVisible();

      expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);

      await page.getByRole('button', { name: 'Add category' }).click();
      await expect(formFields(page).name).toHaveAttribute('aria-invalid', 'true');

      expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);

      await page.goto(`/categories/${shirts.id}/edit`);
      await formFields(page).slug.fill(`${shirts.slug}-moi`);
      await expect(page.getByText(/will stop working/)).toBeVisible();

      expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);
    });
  }
});
