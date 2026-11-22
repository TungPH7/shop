import { expect, type APIRequestContext } from '@playwright/test';

// The categories of the E2E tests of user (SPEC of SHOP-81, TW3; plan, Architecture Decisions 13). user only reads the
// categories, so a test creates, edits and deletes its categories through the admin API, /api/admin/categories, on the
// /api of the admin app, as the helper of the products does (support/products.ts): adminApi(adminUrlFor(baseURL)).
// The name of each one ends with `E2E <runId>`, the run id of its spec file, and fits the 60 characters of a name.

/** The label of an E2E category, at the end of its name, as for a product. */
const E2E_LABEL = /\bE2E [a-z0-9]{6}$/;

/** Categories of a failed run are deleted after this long, so a run never deletes the categories of one in progress. */
const STALE_AFTER_MS = 60 * 60 * 1000;

/** The longest name of a category (SPEC of SHOP-81, Category Rules). */
const NAME_MAX_LENGTH = 60;

export type CategoryStatus = 'VISIBLE' | 'HIDDEN';

export type CategoryInput = {
  name: string;
  /** Left out, the api makes the slug from the name. */
  slug?: string;
  status?: CategoryStatus;
};

/** `AdminCategory` of the API Contract of SHOP-81. */
export type CreatedCategory = {
  id: string;
  name: string;
  slug: string;
  status: CategoryStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
};

type AdminCategoryList = { items: (CreatedCategory & { productCount: number })[] };

/** The name of an E2E category: `<name> E2E <runId>`, within the 60 characters of a name. */
export function categoryName(name: string, runId: string): string {
  const full = `${name} E2E ${runId}`;
  expect(full.length, `the name ${full} is over ${NAME_MAX_LENGTH} characters`).toBeLessThanOrEqual(
    NAME_MAX_LENGTH,
  );
  return full;
}

/** Creates a category, visible unless `input` says otherwise, named `<name> E2E <runId>`. */
export async function createCategory(
  api: APIRequestContext,
  runId: string,
  input: CategoryInput,
): Promise<CreatedCategory> {
  const response = await api.post('/api/admin/categories', {
    data: { ...input, name: categoryName(input.name, runId) },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as CreatedCategory;
}

/**
 * Edits `category` as the form of admin does, with its version: `changes` over its name, slug and status. The name of
 * `changes`, when there is one, is used as given, so a test names it with `categoryName`. Returns the category as the
 * api stored it, with its new version.
 */
export async function updateCategory(
  api: APIRequestContext,
  category: CreatedCategory,
  changes: Partial<Pick<CreatedCategory, 'name' | 'slug' | 'status'>>,
): Promise<CreatedCategory> {
  const { name, slug, status, version } = { ...category, ...changes };
  const response = await api.put(`/api/admin/categories/${category.id}`, {
    data: { name, slug, status, version },
  });
  expect(response.status(), await response.text()).toBe(200);
  return (await response.json()) as CreatedCategory;
}

/** Deletes a category; the api answers 204 even when it is already gone, and its products keep everything but it. */
export async function deleteCategory(api: APIRequestContext, id: string): Promise<void> {
  const response = await api.delete(`/api/admin/categories/${id}`);
  expect(response.status()).toBe(204);
}

/**
 * Deletes the E2E categories of any run created more than an hour ago: those a failed run left behind (TW3). Run it
 * after `deleteStaleProducts`, as the SPEC asks. The admin list holds every category in one response (NFR1).
 */
export async function deleteStaleCategories(
  api: APIRequestContext,
  now = Date.now(),
): Promise<void> {
  const response = await api.get('/api/admin/categories');
  expect(response.status()).toBe(200);
  const { items } = (await response.json()) as AdminCategoryList;
  const stale = items.filter(
    (item) => E2E_LABEL.test(item.name) && now - Date.parse(item.createdAt) > STALE_AFTER_MS,
  );
  for (const { id } of stale) await deleteCategory(api, id);
}
