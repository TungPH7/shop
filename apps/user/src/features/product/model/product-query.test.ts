import { describe, expect, test } from 'vitest';

import { nextProductsHref, PAGE_SIZE, parseProductQuery, productsHref } from './product-query';

describe('parseProductQuery', () => {
  test('defaults page to 1 when the URL has none', () => {
    expect(parseProductQuery({})).toEqual({ page: 1 });
  });

  test.each([
    ['2', 2],
    ['10', 10],
    ['999999', 999999],
  ])('reads page=%s as %i', (raw, page) => {
    expect(parseProductQuery({ page: raw })).toEqual({ page });
  });

  test.each(['0', '-1', 'abc', '1.5', '', 'Infinity', '1e400', ' ', '0x10'])(
    'falls back to page 1 for the wrong value %j, without an error',
    (raw) => {
      expect(parseProductQuery({ page: raw })).toEqual({ page: 1 });
    },
  );

  test('takes the first page of a repeated parameter', () => {
    expect(parseProductQuery({ page: ['3', '5'] })).toEqual({ page: 3 });
  });

  test('ignores unknown parameters', () => {
    expect(parseProductQuery({ page: '2', status: 'HIDDEN' })).toEqual({ page: 2 });
  });
});

describe('productsHref', () => {
  test('leaves the default page 1 out of the URL', () => {
    expect(productsHref({ page: 1 })).toBe('/products');
  });

  test('writes any other page', () => {
    expect(productsHref({ page: 2 })).toBe('/products?page=2');
  });
});

describe('nextProductsHref', () => {
  test('asks for the page after the one shown while products are left', () => {
    expect(nextProductsHref({ page: 1 }, { shown: 24, totalItems: 30, complete: true })).toBe(
      '/products?page=2',
    );
  });

  test('offers nothing once every product is shown', () => {
    expect(nextProductsHref({ page: 2 }, { shown: 30, totalItems: 30, complete: true })).toBeNull();
  });

  test('asks again for the page of the URL after a block failed', () => {
    expect(nextProductsHref({ page: 5 }, { shown: 96, totalItems: 300, complete: false })).toBe(
      '/products?page=5',
    );
  });
});

test('loads 24 products each time, a number 1, 2, 3 and 4 columns divide', () => {
  expect(PAGE_SIZE).toBe(24);
});
