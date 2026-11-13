import { describe, expect, it } from 'vitest';

import { createProductSchema, formatPriceFromCents, productSchema } from './product';

describe('formatPriceFromCents', () => {
  it('formats integer cents as a decimal string', () => {
    expect(formatPriceFromCents(1999)).toBe('19.99');
    expect(formatPriceFromCents(0)).toBe('0.00');
    expect(formatPriceFromCents(100)).toBe('1.00');
  });

  it('throws on a non-integer (invariant)', () => {
    expect(() => formatPriceFromCents(19.99)).toThrow();
  });
});

describe('productSchema', () => {
  it('accepts a valid product', () => {
    const result = productSchema.safeParse({
      id: 'p-1',
      name: 'Widget',
      priceCents: 1999,
      inStock: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative or non-integer price', () => {
    expect(
      productSchema.safeParse({ id: 'p', name: 'x', priceCents: -1, inStock: true }).success,
    ).toBe(false);
    expect(
      productSchema.safeParse({ id: 'p', name: 'x', priceCents: 1.5, inStock: true }).success,
    ).toBe(false);
  });

  it('createProductSchema omits id', () => {
    expect(
      createProductSchema.safeParse({ name: 'x', priceCents: 100, inStock: true }).success,
    ).toBe(true);
  });
});
