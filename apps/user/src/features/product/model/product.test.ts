import { describe, expect, test } from 'vitest';

import {
  discountPercent,
  formatPrice,
  isStoreSlug,
  pageSchema,
  sitemapEntrySchema,
  storeProductSchema,
  storeProductSummarySchema,
} from './product';

// The example StoreProduct of the API Contract (plan of SHOP-7), as GET /api/products/{slug} returns it.
const planExample = {
  id: '019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f',
  name: 'Áo thun cổ tròn',
  slug: 'ao-thun-co-tron',
  price: 200000,
  compareAtPrice: 250000,
  availability: 'IN_STOCK',
  description: 'Áo thun cotton 100%.\nCổ tròn, tay ngắn.',
  updatedAt: '2026-11-16T02:15:30.000Z',
};

describe('storeProductSchema', () => {
  test('parses the example StoreProduct of the plan', () => {
    expect(storeProductSchema.parse(planExample)).toEqual(planExample);
  });

  test('accepts a product without original price or description', () => {
    const product = { ...planExample, compareAtPrice: null, description: null };

    expect(storeProductSchema.parse(product)).toEqual(product);
  });

  test('accepts a product out of stock', () => {
    expect(
      storeProductSchema.parse({ ...planExample, availability: 'OUT_OF_STOCK' }).availability,
    ).toBe('OUT_OF_STOCK');
  });

  test('drops the fields the page does not need', () => {
    const parsed = storeProductSchema.parse({ ...planExample, status: 'HIDDEN', version: 3 });

    expect(parsed).not.toHaveProperty('status');
    expect(parsed).not.toHaveProperty('version');
  });

  test.each([
    ['a price with a fraction', { price: 200000.5 }],
    ['a price as a string', { price: '200000' }],
    ['an unknown availability', { availability: 'SOON' }],
    ['an id that is not a UUID', { id: '42' }],
    ['an updatedAt that is not an instant', { updatedAt: 'yesterday' }],
    ['a missing description', { description: undefined }],
  ])('rejects %s', (_, change) => {
    expect(storeProductSchema.safeParse({ ...planExample, ...change }).success).toBe(false);
  });
});

describe('storeProductSummarySchema', () => {
  test('parses a summary, without description or updatedAt', () => {
    const { description: _description, updatedAt: _updatedAt, ...summary } = planExample;

    expect(storeProductSummarySchema.parse(planExample)).toEqual(summary);
  });
});

describe('pageSchema', () => {
  test('parses a Page of summaries', () => {
    const page = { items: [planExample], totalItems: 30, offset: 0, limit: 24 };

    expect(pageSchema(storeProductSummarySchema).parse(page)).toMatchObject({
      totalItems: 30,
      offset: 0,
      limit: 24,
      items: [{ slug: 'ao-thun-co-tron' }],
    });
  });

  test('rejects a Page with a negative total', () => {
    const page = { items: [], totalItems: -1, offset: 0, limit: 24 };

    expect(pageSchema(storeProductSummarySchema).safeParse(page).success).toBe(false);
  });
});

describe('sitemapEntrySchema', () => {
  test('parses a slug and its updatedAt', () => {
    const entry = { slug: 'ao-thun-co-tron', updatedAt: '2026-11-16T02:15:30.000Z' };

    expect(sitemapEntrySchema.parse(entry)).toEqual(entry);
  });
});

describe('formatPrice', () => {
  test('groups thousands with dots and ends with a non-breaking space and ₫', () => {
    expect(formatPrice(1250000)).toBe('1.250.000 ₫');
  });

  test('formats 200000 as 200.000 ₫', () => {
    expect(formatPrice(200000)).toBe('200.000 ₫');
  });

  test('formats the highest price', () => {
    expect(formatPrice(999999999)).toBe('999.999.999 ₫');
  });
});

describe('discountPercent', () => {
  test('gives 20 for 200.000 against 250.000', () => {
    expect(discountPercent(200000, 250000)).toBe(20);
  });

  test('rounds down: 1.250.000 against 1.500.000 is 16', () => {
    expect(discountPercent(1250000, 1500000)).toBe(16);
  });

  test('computes on integers, so 71 against 100 is 29, not 28', () => {
    expect(discountPercent(71, 100)).toBe(29);
  });

  test('gives at least 1 for a tiny discount', () => {
    expect(discountPercent(999999998, 999999999)).toBe(1);
  });
});

describe('isStoreSlug', () => {
  test.each(['ao-thun-co-tron', 'AO-THUN-CO-TRON', 'combo-3-ao', '-a--b-'])(
    'accepts %s',
    (slug) => {
      expect(isStoreSlug(slug)).toBe(true);
    },
  );

  test.each(['', '..', 'ao thun', 'áo-thun', 'a/b', 'a%2Fb'])('rejects %j', (slug) => {
    expect(isStoreSlug(slug)).toBe(false);
  });
});
