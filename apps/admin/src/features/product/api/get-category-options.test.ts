import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import {
  categoryOptionsKey,
  getCategoryOptions,
} from '@/features/product/api/get-category-options';
import { server } from '@/testing/msw/server';

// The options of the Category field (S4.2 of docs/specs/SHOP-81/design.md), from
// GET /api/admin/categories of the API Contract of docs/specs/SHOP-81/plan.md.

describe('getCategoryOptions', () => {
  it('reads every category, a hidden one too, in the order of the api', async () => {
    server.use(
      http.get('*/admin/categories', () =>
        HttpResponse.json({
          items: [
            { id: 'b', name: 'Áo', status: 'VISIBLE', slug: 'ao', productCount: 3 },
            { id: 'a', name: 'Phụ kiện', status: 'HIDDEN', slug: 'phu-kien', productCount: 0 },
          ],
        }),
      ),
    );

    await expect(getCategoryOptions()).resolves.toEqual([
      { id: 'b', name: 'Áo', status: 'VISIBLE' },
      { id: 'a', name: 'Phụ kiện', status: 'HIDDEN' },
    ]);
  });

  it('rejects a body that is not a list of categories', async () => {
    server.use(http.get('*/admin/categories', () => HttpResponse.json({ items: [{ id: 1 }] })));

    await expect(getCategoryOptions()).rejects.toMatchObject({ kind: 'validation' });
  });

  it('has a key that starts with categories, so a change of a category refreshes it', () => {
    expect(categoryOptionsKey[0]).toBe('categories');
  });
});
