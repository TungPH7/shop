// @vitest-environment node
import { expect, test, vi } from 'vitest';

import { GET } from './route';

const { connection, getProducts } = vi.hoisted(() => ({
  connection: vi.fn(() => Promise.resolve()),
  getProducts: vi.fn(() => Promise.resolve({ items: [], page: 1, totalPages: 3, totalItems: 25 })),
}));

vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  connection,
}));
vi.mock('~/features/product/server/get-products', () => ({ getProducts }));

test('GET answers the count of products, read at request time and not at build', async () => {
  const response = await GET();

  expect(connection).toHaveBeenCalledBefore(getProducts);
  await expect(response.json()).resolves.toEqual({ count: 25 });
});
