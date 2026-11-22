import { describe, expect, test } from 'vitest';

import { categorySitemapEntrySchema, itemListSchema, storeCategorySchema } from './category';

describe('storeCategorySchema', () => {
  test('parses a StoreCategory of the plan of SHOP-81', () => {
    expect(storeCategorySchema.parse({ name: 'Áo khoác', slug: 'ao-khoac' })).toEqual({
      name: 'Áo khoác',
      slug: 'ao-khoac',
    });
  });

  test('drops the fields a shopper never needs, should the api send them', () => {
    const parsed = storeCategorySchema.parse({
      name: 'Áo',
      slug: 'ao',
      status: 'VISIBLE',
      productCount: 3,
      version: 0,
    });

    expect(parsed).toEqual({ name: 'Áo', slug: 'ao' });
  });

  test.each([
    ['a missing name', { slug: 'ao' }],
    ['a missing slug', { name: 'Áo' }],
    ['a name that is not a string', { name: 42, slug: 'ao' }],
  ])('rejects %s', (_, category) => {
    expect(storeCategorySchema.safeParse(category).success).toBe(false);
  });
});

describe('itemListSchema', () => {
  test('parses an ItemList of categories, in the order of the api', () => {
    const list = {
      items: [
        { name: 'Áo khoác', slug: 'ao-khoac' },
        { name: 'Bao tay', slug: 'bao-tay' },
      ],
    };

    expect(itemListSchema(storeCategorySchema).parse(list)).toEqual(list);
  });

  test('rejects a bare array, which is not an ItemList', () => {
    expect(itemListSchema(storeCategorySchema).safeParse([]).success).toBe(false);
  });
});

describe('categorySitemapEntrySchema', () => {
  test('parses a CategorySitemapEntry', () => {
    const entry = { slug: 'ao', updatedAt: '2026-11-22T02:15:30.000Z' };

    expect(categorySitemapEntrySchema.parse(entry)).toEqual(entry);
  });

  test('rejects an updatedAt that is not an instant', () => {
    expect(categorySitemapEntrySchema.safeParse({ slug: 'ao', updatedAt: 'hôm qua' }).success).toBe(
      false,
    );
  });
});
