import { describe, expect, it } from 'vitest';

import {
  adminProductPageSchema,
  adminProductSchema,
  adminProductSummarySchema,
  categoryOptionListSchema,
  formatPrice,
} from '@/features/product/model/product';

// The example payloads of the API Contract in docs/specs/SHOP-7/plan.md.
const summary = {
  id: '019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f',
  name: 'Áo thun cổ tròn',
  slug: 'ao-thun-co-tron',
  price: 200000,
  status: 'ACTIVE',
  availability: 'IN_STOCK',
  createdAt: '2026-11-16T02:10:00.000Z',
  updatedAt: '2026-11-16T02:15:30.000Z',
};

const adminProduct = {
  ...summary,
  description: 'Áo thun cotton 100%.\nCổ tròn, tay ngắn.',
  compareAtPrice: 250000,
  version: 1,
  // The category of the product, in the API Contract of docs/specs/SHOP-81/plan.md.
  categoryId: '019a9c41-2b3d-7e10-8f2a-3c4d5e6f7a8b',
};

describe('adminProductSummarySchema', () => {
  it('parses a product of the admin list', () => {
    expect(adminProductSummarySchema.parse(summary)).toEqual(summary);
  });

  it('parses the AdminProduct example of the contract, keeping only the summary fields', () => {
    expect(adminProductSummarySchema.parse(adminProduct)).toEqual(summary);
  });

  it('accepts a hidden, out-of-stock product priced 0, written before the Epic (NFR16)', () => {
    const legacy = { ...summary, price: 0, status: 'HIDDEN', availability: 'OUT_OF_STOCK' };

    expect(adminProductSummarySchema.parse(legacy)).toEqual(legacy);
  });

  it('rejects a lower-case status, which the API never sends', () => {
    expect(adminProductSummarySchema.safeParse({ ...summary, status: 'active' }).success).toBe(
      false,
    );
  });

  it('rejects a price that is not a whole number of dong', () => {
    expect(adminProductSummarySchema.safeParse({ ...summary, price: 450000.5 }).success).toBe(
      false,
    );
  });
});

describe('adminProductPageSchema', () => {
  it('parses a Page<AdminProductSummary>', () => {
    const page = { items: [summary], totalItems: 25, offset: 20, limit: 20 };

    expect(adminProductPageSchema.parse(page)).toEqual(page);
  });

  it('parses an empty page', () => {
    const page = { items: [], totalItems: 0, offset: 0, limit: 20 };

    expect(adminProductPageSchema.parse(page)).toEqual(page);
  });

  it('rejects a page without its total', () => {
    expect(adminProductPageSchema.safeParse({ items: [], offset: 0, limit: 20 }).success).toBe(
      false,
    );
  });
});

describe('formatPrice', () => {
  it('groups thousands with dots and ends with the dong sign: 1.250.000 ₫', () => {
    expect(formatPrice(1250000)).toBe('1.250.000\u00a0₫');
  });

  it('formats a price under a thousand without a separator', () => {
    expect(formatPrice(0)).toBe('0\u00a0₫');
  });

  it('leaves out the dong sign for a price field, which shows it beside the field (S2.9)', () => {
    expect(formatPrice(450000, { sign: false })).toBe('450.000');
    expect(formatPrice(1250000, { sign: false })).toBe('1.250.000');
  });

  it('formats the largest price', () => {
    expect(formatPrice(999999999)).toBe('999.999.999\u00a0₫');
  });
});

describe('adminProductSchema', () => {
  it('parses the AdminProduct example of the contract', () => {
    expect(adminProductSchema.parse(adminProduct)).toEqual(adminProduct);
  });

  it('accepts a product with no description and no compare-at price', () => {
    const plain = { ...adminProduct, description: null, compareAtPrice: null };

    expect(adminProductSchema.parse(plain)).toEqual(plain);
  });

  it('accepts a product with no category (SHOP-81)', () => {
    const plain = { ...adminProduct, categoryId: null };

    expect(adminProductSchema.parse(plain)).toEqual(plain);
  });

  it('reads a product of an api of before SHOP-81, with no categoryId, as one with no category (NFR19)', () => {
    const older: Partial<typeof adminProduct> = { ...adminProduct };
    delete older.categoryId;

    expect(adminProductSchema.parse(older)).toEqual({ ...older, categoryId: null });
  });

  it('rejects a product without its version, which the edit sends back (AC13)', () => {
    const withoutVersion = { ...adminProduct, version: undefined };

    expect(adminProductSchema.safeParse(withoutVersion).success).toBe(false);
  });
});

describe('categoryOptionListSchema', () => {
  it('parses GET /api/admin/categories of SHOP-81, keeping what the Category field shows', () => {
    const item = {
      id: '019a9c41-2b3d-7e10-8f2a-3c4d5e6f7a8b',
      name: 'Áo khoác',
      slug: 'ao-khoac',
      status: 'HIDDEN',
      productCount: 3,
      createdAt: '2026-11-22T02:10:00.000Z',
      updatedAt: '2026-11-22T02:15:30.000Z',
      version: 0,
    };

    expect(categoryOptionListSchema.parse({ items: [item] })).toEqual({
      items: [{ id: item.id, name: 'Áo khoác', status: 'HIDDEN' }],
    });
  });
});
