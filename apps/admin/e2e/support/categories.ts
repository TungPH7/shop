import { type APIRequestContext, expect } from '@playwright/test';

import { e2eName } from './products';

// Categories of the E2E tests of admin (TW3 of docs/specs/SHOP-81/spec.md; plan,
// Architecture Decisions 13). They go through /api of the admin host, as the app does,
// with the basic auth Playwright gives the request fixture on Development and Staging.
// - The name of each category ends with `E2E <runId>`, as a product, and fits 60
//   characters: the name before it has at most 49.
// - The admin list returns every category, so a test only checks the categories of its
//   run, found by that end of their name (AC1).
// - Before a run, `deleteStaleE2eCategories` deletes the E2E categories made over an
//   hour ago, after the stale E2E products are gone (NFR23 of SHOP-7).

const API = '/api/admin/categories';
const STALE_AFTER_MS = 60 * 60 * 1000;
const E2E_NAME = /\bE2E [a-z0-9]{6}$/;

export type E2eCategoryStatus = 'VISIBLE' | 'HIDDEN';

export interface E2eCategory {
  id: string;
  name: string;
  slug: string;
  status: E2eCategoryStatus;
  /** 0–9999, 0 when the category was added without one (SHOP-95). */
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface E2eCategoryRow extends E2eCategory {
  productCount: number;
}

export interface NewE2eCategory {
  /** The name before `E2E <runId>`. */
  name: string;
  slug?: string;
  status?: E2eCategoryStatus;
  /** Sent only when set: a category added without one gets 0 (TW3 of SHOP-95). */
  displayOrder?: number;
}

export async function createCategory(
  request: APIRequestContext,
  runId: string,
  category: NewE2eCategory,
): Promise<E2eCategory> {
  const response = await request.post(API, {
    data: {
      name: e2eName(category.name, runId),
      ...(category.slug === undefined ? {} : { slug: category.slug }),
      status: category.status ?? 'VISIBLE',
      ...(category.displayOrder === undefined ? {} : { displayOrder: category.displayOrder }),
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as E2eCategory;
}

/** Every category, as the admin list has them: in the order of the api. */
export async function listCategories(request: APIRequestContext): Promise<E2eCategoryRow[]> {
  const response = await request.get(API);
  expect(response.status()).toBe(200);
  return ((await response.json()) as { items: E2eCategoryRow[] }).items;
}

/** The categories of one run, in the order of the api. */
export async function categoriesOfRun(
  request: APIRequestContext,
  runId: string,
): Promise<E2eCategoryRow[]> {
  return (await listCategories(request)).filter((item) => item.name.endsWith(` E2E ${runId}`));
}

/** One category as GET /api/admin/categories/{id} answers, or null once it is gone. */
export async function getCategory(
  request: APIRequestContext,
  id: string,
): Promise<E2eCategory | null> {
  const response = await request.get(`${API}/${id}`);
  if (response.status() === 404) return null;
  expect(response.status()).toBe(200);
  return (await response.json()) as E2eCategory;
}

export async function deleteCategories(
  request: APIRequestContext,
  categories: readonly { id: string }[],
): Promise<void> {
  for (const category of categories) {
    const response = await request.delete(`${API}/${category.id}`);
    expect(response.status()).toBe(204);
  }
}

/** Deletes the E2E categories of any run that were made over an hour ago. */
export async function deleteStaleE2eCategories(request: APIRequestContext): Promise<void> {
  const before = Date.now() - STALE_AFTER_MS;
  const stale = (await listCategories(request)).filter(
    (item) => E2E_NAME.test(item.name) && Date.parse(item.createdAt) < before,
  );
  await deleteCategories(request, stale);
}
