import { describe, expect, it } from 'vitest';

import { NAV_ITEMS, isCurrentPath } from '~/features/site/model/nav';

describe('NAV_ITEMS', () => {
  it('lists Home, Products and About, in that order (S4.1)', () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual(['/', '/products', '/about']);
  });
});

describe('isCurrentPath', () => {
  it('marks Home only on the home page itself', () => {
    expect(isCurrentPath('/', '/')).toBe(true);
    expect(isCurrentPath('/about', '/')).toBe(false);
    expect(isCurrentPath('/products', '/')).toBe(false);
  });

  it('marks Products on the list and on a product detail page', () => {
    expect(isCurrentPath('/products', '/products')).toBe(true);
    expect(isCurrentPath('/products/ao-thun-co-tron', '/products')).toBe(true);
  });

  it('marks Products on S6, the page the Proxy serves for a product that is not there', () => {
    expect(isCurrentPath('/product-not-found', '/products')).toBe(true);
    expect(isCurrentPath('/product-not-found', '/about')).toBe(false);
  });

  it('does not mark a section whose name only starts the same way', () => {
    expect(isCurrentPath('/products-archive', '/products')).toBe(false);
  });

  it('ignores a trailing slash', () => {
    expect(isCurrentPath('/about/', '/about')).toBe(true);
  });

  it('marks nothing on a page outside the three sections', () => {
    expect(NAV_ITEMS.some((item) => isCurrentPath('/login', item.href))).toBe(false);
  });
});
