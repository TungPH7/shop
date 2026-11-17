import { randomInt } from 'node:crypto';

import { expect, request, type APIRequestContext } from '@playwright/test';

import { isLocal } from './env';

// The products of the E2E tests of user (plan of SHOP-7, Architecture Decisions 16; NFR23). user only reads the
// catalog, so a test creates and deletes its products through the admin API, /api/admin/products, on the /api of the
// admin app: E2E_ADMIN_URL on an environment, the admin app Playwright starts here otherwise. A test tagged @local runs
// on the apps started here even on an environment, so it reaches the admin started here too: `adminUrlFor(baseURL)`
// gives the admin of the catalog the page reads (QA of SHOP-28). On an environment, basic auth goes to the origin of
// admin only, as playwright.config.ts does for each app.

const OFFSET = Number(process.env.AO_PORT_OFFSET ?? 0) || 0;

/** The admin app Playwright starts here, on its port moved by the offset of the run. */
export const localAdminUrl = `http://localhost:${5173 + OFFSET}`;

/** The admin app: its /api reaches the api. */
export const adminUrl = process.env.E2E_ADMIN_URL || localAdminUrl;

/**
 * The admin app whose api the page at `baseURL` reads: the one started here for a page started here, such as in the
 * user-local project of a run on an environment; the admin of the environment otherwise.
 */
export function adminUrlFor(baseURL: string | undefined): string {
  return isLocal(baseURL) ? localAdminUrl : adminUrl;
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** Six random characters of this run, in the name of each of its products. */
export const runId = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');

/** The label of an E2E product, at the end of its name so a name still starts with its words. */
const E2E_LABEL = /\bE2E [a-z0-9]{6}$/;

/** Products of a failed run are deleted after this long, so a run never deletes the products of one in progress. */
const STALE_AFTER_MS = 60 * 60 * 1000;

export type ProductInput = {
  name: string;
  price: number;
  compareAtPrice?: number | null;
  description?: string | null;
  availability?: 'IN_STOCK' | 'OUT_OF_STOCK';
  status?: 'ACTIVE' | 'HIDDEN';
};

/** `updatedAt` is the last edit the api stored: the `lastmod` of the product in the sitemap (AC28). */
export type CreatedProduct = { id: string; name: string; slug: string; updatedAt: string };

type AdminProductSummary = { id: string; name: string; createdAt: string };

type AdminProductPage = { items: AdminProductSummary[]; totalItems: number };

/** A request context on an admin app, that of the environment by default. Dispose of it when done. */
export function adminApi(url: string = adminUrl): Promise<APIRequestContext> {
  const username = process.env.E2E_HTTP_USER;
  const password = process.env.E2E_HTTP_PASSWORD;
  return request.newContext({
    baseURL: url,
    // The basic auth of an environment never goes to the apps started here.
    ...(username && password && !isLocal(url)
      ? { httpCredentials: { username, password, origin: new URL(url).origin } }
      : {}),
  });
}

/** Creates a product on sale, named `<name> E2E <runId>`; the api makes its slug from that name. */
export async function createProduct(
  api: APIRequestContext,
  input: ProductInput,
): Promise<CreatedProduct> {
  const response = await api.post('/api/admin/products', {
    data: { ...input, name: `${input.name} E2E ${runId}` },
  });
  expect(response.status(), await response.text()).toBe(201);
  const { id, name, slug, updatedAt } = (await response.json()) as CreatedProduct;
  return { id, name, slug, updatedAt };
}

/** Deletes a product; the api answers 204 even when it is already gone. */
export async function deleteProduct(api: APIRequestContext, id: string): Promise<void> {
  const response = await api.delete(`/api/admin/products/${id}`);
  expect(response.status()).toBe(204);
}

/** Deletes the E2E products of any run created more than an hour ago: those a failed run left behind (NFR23). */
export async function deleteStaleProducts(api: APIRequestContext, now = Date.now()): Promise<void> {
  const stale: string[] = [];
  for (let offset = 0; ; offset += 100) {
    const response = await api.get('/api/admin/products', {
      params: { q: 'e2e', status: 'ALL', offset, limit: 100 },
    });
    expect(response.status()).toBe(200);
    const page = (await response.json()) as AdminProductPage;
    stale.push(
      ...page.items
        .filter(
          (item) => E2E_LABEL.test(item.name) && now - Date.parse(item.createdAt) > STALE_AFTER_MS,
        )
        .map((item) => item.id),
    );
    if (page.items.length === 0 || offset + page.items.length >= page.totalItems) break;
  }
  for (const id of stale) await deleteProduct(api, id);
}
