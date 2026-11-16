import { type APIRequestContext, expect } from '@playwright/test';

// Products of the E2E tests of admin (plan of SHOP-7, Architecture Decisions 16; NFR23).
// They go through /api of the admin host, as the app does: Playwright gives the request
// fixture the basic auth of that origin on Development and Staging.
// - The name of each product ends with the two words `E2E <runId>`, `runId` being six
//   random characters of the run, so a count can search `e2e <runId>` and see only the
//   products of that run.
// - Before a run, `deleteStaleE2eProducts` deletes E2E products made over an hour ago,
//   which a run that stopped half-way left behind.

const API = '/api/admin/products';
const STALE_AFTER_MS = 60 * 60 * 1000;
const E2E_NAME = /\bE2E [a-z0-9]{6}$/;

export interface E2eProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  status: 'ACTIVE' | 'HIDDEN';
  availability: 'IN_STOCK' | 'OUT_OF_STOCK';
  createdAt: string;
}

export interface NewE2eProduct {
  /** The name before `E2E <runId>`. */
  name: string;
  price?: number;
  status?: E2eProduct['status'];
  availability?: E2eProduct['availability'];
}

/** Six random characters, a–z and 0–9. */
export function newRunId(): string {
  return Array.from(
    { length: 6 },
    () => '0123456789abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 36)],
  ).join('');
}

/** The name a product of this run gets: `<name> E2E <runId>`. */
export function e2eName(name: string, runId: string): string {
  return `${name} E2E ${runId}`;
}

/**
 * A name of exactly `length` characters that still ends with ` E2E <runId>`, for a
 * test of a name too long: if the api took it, the clean-up would still find it (NFR23).
 */
export function e2eNameOfLength(length: number, runId: string): string {
  const tail = e2eName('', runId);
  return `${'a'.repeat(length - tail.length)}${tail}`;
}

export async function createProduct(
  request: APIRequestContext,
  runId: string,
  product: NewE2eProduct,
): Promise<E2eProduct> {
  const response = await request.post(API, {
    data: {
      name: e2eName(product.name, runId),
      price: product.price ?? 100000,
      status: product.status ?? 'ACTIVE',
      availability: product.availability ?? 'IN_STOCK',
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return (await response.json()) as E2eProduct;
}

/** Products one after the other, so each is newer than the one before it. */
export async function createProducts(
  request: APIRequestContext,
  runId: string,
  products: NewE2eProduct[],
): Promise<E2eProduct[]> {
  const created: E2eProduct[] = [];
  for (const product of products) created.push(await createProduct(request, runId, product));
  return created;
}

/** The products whose name matches `q`, as the admin list finds them: for products a test made in the form. */
export async function findProducts(request: APIRequestContext, q: string): Promise<E2eProduct[]> {
  const response = await request.get(API, { params: { q, offset: 0, limit: 100 } });
  expect(response.status()).toBe(200);
  return ((await response.json()) as { items: E2eProduct[] }).items;
}

export async function deleteProducts(
  request: APIRequestContext,
  products: readonly { id: string }[],
): Promise<void> {
  for (const product of products) {
    const response = await request.delete(`${API}/${product.id}`);
    expect(response.status()).toBe(204);
  }
}

/** Deletes the E2E products of any run that were made over an hour ago. */
export async function deleteStaleE2eProducts(request: APIRequestContext): Promise<void> {
  const before = Date.now() - STALE_AFTER_MS;
  const stale: E2eProduct[] = [];
  for (let offset = 0; ; offset += 100) {
    const response = await request.get(API, { params: { q: 'e2e', offset, limit: 100 } });
    expect(response.status()).toBe(200);
    const page = (await response.json()) as { items: E2eProduct[]; totalItems: number };
    stale.push(
      ...page.items.filter(
        (item) => E2E_NAME.test(item.name) && Date.parse(item.createdAt) < before,
      ),
    );
    if (offset + 100 >= page.totalItems) break;
  }
  await deleteProducts(request, stale);
}
