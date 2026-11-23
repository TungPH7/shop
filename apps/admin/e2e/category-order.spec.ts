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

// The display order of categories (docs/specs/SHOP-95/spec.md; Story SHOP-96), on the
// real api, here or on Development: AC4 straight on /api of the admin host, AC6 in the
// Category field of the product form (S4.2 of SHOP-81), and the admin part of AC8.
// Development is shared, so each test only compares the categories of its run, named
// `… E2E <runId>`, and deletes them when done (Architecture Decisions 10 of the plan).
// E2E of SHOP-81 have names starting with the same codes: run one criterion of this file
// with the file, as in `e2e/category-order.spec.ts -g "AC6"`.
test.describe.configure({ mode: 'default' });

const API = '/api/admin/categories';
const runId = newRunId();
let categories: E2eCategory[] = [];

test.beforeAll(async ({ request }) => {
  await deleteStaleE2eProducts(request);
  await deleteStaleE2eCategories(request);
});

test.afterEach(async ({ request }) => {
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

/** The fields of the 400 VALIDATION_FAILED of a response, with their messages. */
async function fieldErrorsOf(response: {
  json(): Promise<unknown>;
}): Promise<{ field: string; message: string }[]> {
  const body = (await response.json()) as {
    code: string;
    errors?: { field: string; message: string }[];
  };
  expect(body.code).toBe('VALIDATION_FAILED');
  return (body.errors ?? []).map(({ field, message }) => ({ field, message }));
}

/** "Áo" 2, "Bao tay" 1, "Đầm" 1 and "Quần" 0, "Đầm" hidden, added in neither order. */
async function theFourCategoriesOfAc5(request: APIRequestContext) {
  const dresses = await addCategory(request, { name: 'Đầm', displayOrder: 1, status: 'HIDDEN' });
  const shirts = await addCategory(request, { name: 'Áo', displayOrder: 2 });
  const trousers = await addCategory(request, { name: 'Quần', displayOrder: 0 });
  const gloves = await addCategory(request, { name: 'Bao tay', displayOrder: 1 });
  return { dresses, shirts, trousers, gloves };
}

function table(page: Page): Locator {
  return page.getByRole('table', { name: 'Category list' });
}

test.describe('AC4 the display order on the admin API', () => {
  const WRONG = [
    { sent: -1, message: 'must be at least 0' },
    { sent: 10000, message: 'must be at most 9999' },
    { sent: 1.5, message: 'must be a whole number' },
  ];

  test('AC4 refuses -1, 10000 and 1.5 on an add with a 400 on displayOrder, and adds nothing', async ({
    request,
  }) => {
    for (const { sent, message } of WRONG) {
      const response = await request.post(API, {
        data: { name: e2eName(`Thứ tự ${sent}`, runId), displayOrder: sent },
      });

      expect(response.status(), `displayOrder ${sent}`).toBe(400);
      expect(response.headers()['content-type']).toContain('application/problem+json');
      expect(await fieldErrorsOf(response)).toEqual([{ field: 'displayOrder', message }]);
    }
    expect(await categoriesOfRun(request, runId)).toEqual([]);
  });

  test('AC4 refuses -1, 10000 and 1.5 on an edit with a 400 on displayOrder, and changes nothing', async ({
    request,
  }) => {
    const shirts = await addCategory(request, { name: 'Áo', displayOrder: 7 });

    for (const { sent, message } of WRONG) {
      const response = await request.put(`${API}/${shirts.id}`, {
        data: {
          name: e2eName('Áo nam', runId),
          slug: shirts.slug,
          status: shirts.status,
          displayOrder: sent,
          version: shirts.version,
        },
      });

      expect(response.status(), `displayOrder ${sent}`).toBe(400);
      expect(await fieldErrorsOf(response)).toEqual([{ field: 'displayOrder', message }]);
    }
    expect(await getCategory(request, shirts.id)).toMatchObject({
      name: shirts.name,
      displayOrder: 7,
      version: shirts.version,
    });
  });

  test('AC4 refuses "abc" on an add and on an edit with a 400 Problem Details, and saves nothing', async ({
    request,
  }) => {
    const shirts = await addCategory(request, { name: 'Áo', displayOrder: 7 });

    const add = await request.post(API, {
      data: { name: e2eName('Chữ', runId), displayOrder: 'abc' },
    });
    const edit = await request.put(`${API}/${shirts.id}`, {
      data: {
        name: shirts.name,
        slug: shirts.slug,
        status: shirts.status,
        displayOrder: 'abc',
        version: shirts.version,
      },
    });

    for (const response of [add, edit]) {
      expect(response.status()).toBe(400);
      expect(response.headers()['content-type']).toContain('application/problem+json');
    }
    expect((await categoriesOfRun(request, runId)).map(({ name }) => name)).toEqual([shirts.name]);
    expect(await getCategory(request, shirts.id)).toMatchObject({
      displayOrder: 7,
      version: shirts.version,
    });
  });

  test('AC4 gives 0 to a category added without a display order', async ({ request }) => {
    const shirts = await addCategory(request, { name: 'Áo' });

    expect(shirts.displayOrder).toBe(0);
    expect(await getCategory(request, shirts.id)).toMatchObject({ displayOrder: 0 });
  });

  test('AC4 keeps 7 when the name of a category is edited without a display order, as an old tab does', async ({
    request,
  }) => {
    const shirts = await addCategory(request, { name: 'Áo', displayOrder: 7 });
    const renamed = e2eName('Áo nam', runId);

    // The body of the edit form of SHOP-81: no displayOrder.
    const response = await request.put(`${API}/${shirts.id}`, {
      data: { name: renamed, slug: shirts.slug, status: shirts.status, version: shirts.version },
    });

    expect(response.status(), await response.text()).toBe(200);
    expect(await response.json()).toMatchObject({ name: renamed, displayOrder: 7 });
    expect(await getCategory(request, shirts.id)).toMatchObject({
      name: renamed,
      displayOrder: 7,
    });
  });
});

test('AC6 lists No category first, then the categories by display order, then name, hidden ones too', async ({
  page,
  request,
}) => {
  const { dresses, shirts, trousers, gloves } = await theFourCategoriesOfAc5(request);

  await page.goto('/products/new');
  await page.getByLabel('Language').selectOption('vi');
  const field = page.getByRole('combobox', { name: 'Danh mục' });
  await expect(field).toBeEnabled();

  const options = await field.locator('option').allInnerTexts();
  expect(options[0]).toBe('Không có danh mục');
  expect(options.filter((text) => text.includes(` E2E ${runId}`))).toEqual([
    trousers.name,
    gloves.name,
    `${dresses.name} (Ẩn)`,
    shirts.name,
  ]);
});

test('AC8 gives 0 to three categories added without a display order, and lists them by name', async ({
  page,
  request,
}) => {
  // Added in the reverse order of their names.
  const trousers = await addCategory(request, { name: 'Quần' });
  const gloves = await addCategory(request, { name: 'Bao tay' });
  const jackets = await addCategory(request, { name: 'Áo khoác' });

  const ofRun = await categoriesOfRun(request, runId);
  expect(ofRun.map(({ name, displayOrder }) => [name, displayOrder])).toEqual([
    [jackets.name, 0],
    [gloves.name, 0],
    [trousers.name, 0],
  ]);

  await page.goto('/categories');
  await expect(table(page).locator('tbody tr').filter({ hasText: trousers.name })).toBeVisible();
  const names = await table(page).locator('tbody tr .table__name').allInnerTexts();
  expect(names.filter((name) => name.endsWith(` E2E ${runId}`))).toEqual([
    jackets.name,
    gloves.name,
    trousers.name,
  ]);
});
