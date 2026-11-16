import { describe, expect, it } from 'vitest';

import { paths } from '@/config/paths';

describe('paths', () => {
  it('keeps no route pattern of the template product pages', () => {
    const patterns = Object.values(paths).map((page) => page.path);

    expect(patterns).not.toContain('/products/:productId');
    expect(patterns).not.toContain('/admin/products/:productId/edit');
  });

  it('keeps the products list route for US1', () => {
    expect(paths.products.path).toBe('/products');
    expect(paths.products.getHref()).toBe('/products');
  });
});
