import AxeBuilder from '@axe-core/playwright';
import { expect, type Locator, type Page, test } from '@playwright/test';

import {
  createProduct,
  deleteProducts,
  deleteStaleE2eProducts,
  type E2eProduct,
  e2eName,
  e2eNameOfLength,
  findProducts,
  newRunId,
} from './support/products';

// US2 (SHOP-20): S2 of docs/specs/SHOP-7/design.md in add mode, against the real api,
// here or on Development. Each test deletes the products it made, through the API or
// through the form, named `… E2E <runId>`. The tests of this file run one after the
// other, so a count of the products of this run sees only those of one test.
test.describe.configure({ mode: 'default' });

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const API = '/api/admin/products';

const runId = newRunId();
let created: E2eProduct[] = [];

test.beforeAll(async ({ request }) => {
  await deleteStaleE2eProducts(request);
});

test.afterEach(async ({ request }) => {
  // The products of this run, made by the API or by the form.
  await deleteProducts(request, [...created, ...(await findProducts(request, `e2e ${runId}`))]);
  created = [];
});

function form(page: Page) {
  return {
    name: page.getByRole('textbox', { name: /^Product name/ }),
    slug: page.getByRole('textbox', { name: 'URL slug' }),
    description: page.getByRole('textbox', { name: 'Description (optional)' }),
    price: page.getByRole('textbox', { name: /^Price/ }),
    compareAtPrice: page.getByRole('textbox', { name: 'Compare-at price (₫) (optional)' }),
    save: page.getByRole('button', { name: 'Add product' }),
  };
}

function rowsOf(page: Page): Locator {
  return page.getByRole('table', { name: 'Product list' }).locator('tbody tr');
}

/** Records the POSTs the page sends to the API, to show that a save did not reach it. */
function postsOf(page: Page): string[] {
  const posts: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === API) {
      posts.push(request.url());
    }
  });
  return posts;
}

test.describe('US2 add a product', () => {
  test('AC5 fills the slug from the name, saves, and shows the product first in the list', async ({
    page,
    request,
  }) => {
    // A product made just before, so the new one must come before it.
    created = [await createProduct(request, runId, { name: 'Quần jean nam' })];
    const name = e2eName('Đầm maxi đỏ', runId);
    await page.goto('/products');
    await page.getByRole('link', { name: 'Add product' }).first().click();
    await expect(page).toHaveURL(/\/products\/new$/);
    const fields = form(page);

    await fields.name.fill('Đầm maxi đỏ');
    await expect(fields.slug).toHaveValue('dam-maxi-do');
    await fields.name.fill(name);
    await fields.price.fill('450000');
    await fields.save.click();

    await expect(page.getByRole('status').filter({ hasText: 'Product added' })).toBeVisible();
    await expect(page).toHaveURL(/\/products$/);
    const row = rowsOf(page).filter({ hasText: name });
    await expect(row.getByRole('cell').nth(1)).toHaveText(/^450\.000\s₫$/);
    await expect(row.getByText('Active', { exact: true })).toBeVisible();
    await expect(row.getByText('In stock', { exact: true })).toBeVisible();
    await expect(row.getByText(`dam-maxi-do-e2e-${runId}`, { exact: true })).toBeVisible();
    const names = await rowsOf(page).locator('.table__name').allTextContents();
    expect(names.indexOf(name)).toBeLessThan(names.indexOf(created[0]!.name));
    // First of the list: among the products of this run, the newest is first.
    await page.getByRole('searchbox', { name: 'Search by name' }).fill(`e2e ${runId}`);
    await expect(rowsOf(page).locator('.table__name')).toHaveText([name, created[0]!.name]);
  });

  const invalid = [
    ['an empty name', { name: '' }, 'name', 'Enter a product name'],
    [
      'a name of 151 characters',
      { name: e2eNameOfLength(151, runId) },
      'name',
      'Name must be 150 characters or fewer',
    ],
    ['a slug with capitals', { slug: 'Dam-Maxi' }, 'slug', 'Use lowercase a–z'],
    ['a slug with accents', { slug: 'đầm-maxi' }, 'slug', 'Use lowercase a–z'],
    ['a slug with a space', { slug: 'dam maxi' }, 'slug', 'Use lowercase a–z'],
    ['a price of 0', { price: '0' }, 'price', 'Price must be greater than 0'],
    [
      'a price with a fraction',
      { price: '450000,5' },
      'price',
      'Price must be a whole number of đồng',
    ],
    [
      'a compare-at price not above the price',
      { compareAtPrice: '450000' },
      'compareAtPrice',
      'Compare-at price must be greater than the price',
    ],
    [
      'a description of 5.001 characters',
      { description: 'a'.repeat(5001) },
      'description',
      'Description must be 5,000 characters or fewer',
    ],
  ] as const;

  for (const [name, overrides, field, message] of invalid) {
    test(`AC6 does not save ${name}, shows the error under the field and keeps the input`, async ({
      page,
    }) => {
      const posts = postsOf(page);
      await page.goto('/products/new');
      const fields = form(page);
      const typed: Record<'name' | 'slug' | 'description' | 'price' | 'compareAtPrice', string> = {
        name: e2eName('Đầm maxi đỏ', runId),
        slug: '',
        description: 'Váy dài.\nVải voan.',
        price: '450000',
        compareAtPrice: '',
        ...overrides,
      };
      for (const [key, value] of Object.entries(typed)) {
        if (value !== '') await fields[key as keyof typeof typed].fill(value);
      }

      await fields.save.click();

      const control = fields[field];
      await expect(control).toHaveAttribute('aria-invalid', 'true');
      await expect(control).toHaveAccessibleDescription(new RegExp(`^${message}`));
      await expect(control).toBeFocused();
      await expect(page).toHaveURL(/\/products\/new$/);
      expect(posts).toEqual([]);
      for (const [key, value] of Object.entries(typed)) {
        // A slug left to the name follows it; only what was typed is compared.
        if (key === 'slug' && value === '') continue;
        const shown = await fields[key as keyof typeof typed].inputValue();
        // A price shows its grouping once left: 450000 as 450.000.
        expect(key.endsWith('rice') ? shown.replaceAll('.', '') : shown, key).toBe(value);
      }
    });
  }

  test('AC7 the API answers 400 Problem Details naming each invalid field, and saves nothing', async ({
    request,
  }) => {
    const valid = {
      name: e2eName('Đầm maxi đỏ', runId),
      price: 450000,
      status: 'ACTIVE',
      availability: 'IN_STOCK',
    };
    const cases = [
      [{ name: '' }, 'name'],
      [{ name: e2eNameOfLength(151, runId) }, 'name'],
      [{ slug: 'Dam-Maxi' }, 'slug'],
      [{ slug: 'đầm-maxi' }, 'slug'],
      [{ slug: 'dam maxi' }, 'slug'],
      [{ price: 0 }, 'price'],
      [{ price: 450000.5 }, 'price'],
      [{ compareAtPrice: 450000 }, 'compareAtPrice'],
      [{ description: 'a'.repeat(5001) }, 'description'],
    ] as const;

    for (const [overrides, field] of cases) {
      const response = await request.post(API, { data: { ...valid, ...overrides } });

      expect(response.status(), JSON.stringify(overrides).slice(0, 80)).toBe(400);
      expect(response.headers()['content-type']).toContain('application/problem+json');
      const problem = (await response.json()) as {
        status: number;
        code: string;
        errors: { field: string }[];
      };
      expect(problem).toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
      expect(problem.errors.map((error) => error.field)).toEqual([field]);
    }

    // Every invalid field at once, in one answer.
    const all = await request.post(API, {
      data: {
        name: '',
        slug: 'Dam Maxi',
        description: 'a'.repeat(5001),
        price: 450000.5,
        compareAtPrice: 400000,
      },
    });
    expect(all.status()).toBe(400);
    const fields = ((await all.json()) as { errors: { field: string }[] }).errors.map(
      (error) => error.field,
    );
    expect([...new Set(fields)].sort()).toEqual(
      ['compareAtPrice', 'description', 'name', 'price', 'slug'].sort(),
    );

    expect(await findProducts(request, `e2e ${runId}`)).toEqual([]);
  });

  test('AC8 adds -2 to a generated slug that is taken, and refuses a typed slug that is taken', async ({
    page,
    request,
  }) => {
    const name = e2eName('Áo thun cổ tròn', runId);
    created = [await createProduct(request, runId, { name: 'Áo thun cổ tròn' })];
    const taken = created[0]!.slug;
    expect(taken).toBe(`ao-thun-co-tron-e2e-${runId}`);

    await page.goto('/products/new');
    let fields = form(page);
    await fields.name.fill(name);
    await expect(fields.slug).toHaveValue(taken);
    await fields.price.fill('250000');
    await fields.save.click();

    await expect(page.getByRole('status').filter({ hasText: 'Product added' })).toBeVisible();
    await expect(page).toHaveURL(/\/products$/);
    await expect(rowsOf(page).getByText(`${taken}-2`, { exact: true })).toBeVisible();

    const posts = postsOf(page);
    await page.goto('/products/new');
    fields = form(page);
    await fields.name.fill(e2eName('Áo thun basic', runId));
    await fields.slug.fill(taken);
    await fields.price.fill('250000');
    await fields.save.click();

    await expect(fields.slug).toHaveAccessibleDescription(/^This slug is already in use/);
    await expect(fields.slug).toBeFocused();
    await expect(page).toHaveURL(/\/products\/new$/);
    expect(posts).toHaveLength(1);
    const slugs = (await findProducts(request, `e2e ${runId}`)).map((product) => product.slug);
    expect(slugs.sort()).toEqual([taken, `${taken}-2`]);
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`S2 has no WCAG A/AA violation in the ${colorScheme} theme, with and without errors`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/products/new');
      await expect(form(page).name).toBeVisible();

      expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);

      await form(page).slug.fill('Sai Slug');
      await form(page).save.click();
      await expect(form(page).name).toHaveAttribute('aria-invalid', 'true');

      expect((await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()).violations).toEqual([]);
    });
  }
});
