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

  it('has the add page of US2 that S1.3 links to (plan, Architecture Decisions 11)', () => {
    expect(paths.productNew.path).toBe('/products/new');
    expect(paths.productNew.getHref()).toBe('/products/new');
  });

  it('has the edit page of US3 that S1.7 links to, with the id of the product', () => {
    expect(paths.productEdit.path).toBe('/products/:productId/edit');
    expect(paths.productEdit.getHref('019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f')).toBe(
      '/products/019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f/edit',
    );
  });

  it('has the category list S1, and the add and edit pages S2, of SHOP-81', () => {
    expect(paths.categories.path).toBe('/categories');
    expect(paths.categories.getHref()).toBe('/categories');
    expect(paths.categoryNew.path).toBe('/categories/new');
    expect(paths.categoryNew.getHref()).toBe('/categories/new');
    expect(paths.categoryEdit.path).toBe('/categories/:categoryId/edit');
    expect(paths.categoryEdit.getHref('a/b?c')).toBe('/categories/a%2Fb%3Fc/edit');
  });

  it('escapes an id that is not a plain segment', () => {
    expect(paths.productEdit.getHref('a/b?c')).toBe('/products/a%2Fb%3Fc/edit');
  });
});
