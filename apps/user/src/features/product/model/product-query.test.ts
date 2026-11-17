import { describe, expect, test } from 'vitest';

import {
  apiSortOf,
  chosenSortOf,
  foldKeyword,
  nextProductsHref,
  PAGE_SIZE,
  parseProductQuery,
  productsHref,
  searchHref,
  sortHref,
  sortsFor,
} from './product-query';

describe('parseProductQuery', () => {
  test('reads no search, the newest first and page 1 when the URL has none', () => {
    expect(parseProductQuery({})).toEqual({ q: '', sort: 'newest', page: 1 });
  });

  test.each([
    ['2', 2],
    ['10', 10],
    ['999999', 999999],
  ])('reads page=%s as %i', (raw, page) => {
    expect(parseProductQuery({ page: raw }).page).toBe(page);
  });

  test.each(['0', '-1', 'abc', '1.5', '', 'Infinity', '1e400', ' ', '0x10'])(
    'falls back to page 1 for the wrong value %j, without an error (AC22)',
    (raw) => {
      expect(parseProductQuery({ page: raw }).page).toBe(1);
    },
  );

  test('takes the first value of a repeated parameter', () => {
    expect(parseProductQuery({ page: ['3', '5'], q: ['ao', 'quan'] })).toEqual({
      q: 'ao',
      sort: 'relevance',
      page: 3,
    });
  });

  test('ignores unknown parameters', () => {
    expect(parseProductQuery({ page: '2', status: 'HIDDEN' })).toEqual({
      q: '',
      sort: 'newest',
      page: 2,
    });
  });

  test('keeps the keyword as typed, without the spaces around and between its words', () => {
    expect(parseProductQuery({ q: '  Áo   Thun \t ' }).q).toBe('Áo Thun');
  });

  test('cuts the keyword at 100 characters, as the api does', () => {
    expect(parseProductQuery({ q: 'a'.repeat(150) }).q).toBe('a'.repeat(100));
  });

  test.each(['', '   '])('reads the keyword %j as no search', (q) => {
    expect(parseProductQuery({ q })).toEqual({ q: '', sort: 'newest', page: 1 });
  });

  // JavaScript's trim() and \s do not count U+0085 or U+001C–U+001F as spaces, while the api does: a keyword of them
  // alone was sent as a search the api refused with 400, an error Try again never left (AC22).
  test.each(['\u0085', '\u001c', '\u001f', '\u0000', '\u007f', ' \u0085\t\u001e '])(
    'reads the keyword %j, only control characters and spaces, as no search (AC22)',
    (q) => {
      expect(parseProductQuery({ q })).toEqual({ q: '', sort: 'newest', page: 1 });
    },
  );

  test('falls back to the newest first for sort=relevance with a keyword of control characters (AC22)', () => {
    expect(parseProductQuery({ q: '\u001f', sort: 'relevance' })).toEqual({
      q: '',
      sort: 'newest',
      page: 1,
    });
  });

  test('reads a control character between two words as a space', () => {
    expect(parseProductQuery({ q: 'áo\u0085\u001fthun\u0000' }).q).toBe('áo thun');
  });

  test('cuts the keyword at 100 characters after its control characters became spaces', () => {
    expect(parseProductQuery({ q: `${'\u001f'.repeat(10)}${'a'.repeat(150)}` }).q).toBe(
      'a'.repeat(100),
    );
  });

  test('sorts a search by relevance by default (AC18)', () => {
    expect(parseProductQuery({ q: 'ao' }).sort).toBe('relevance');
  });

  test.each(['newest', 'price-asc', 'price-desc'] as const)(
    'reads sort=%s with or without a search (AC20)',
    (sort) => {
      expect(parseProductQuery({ sort }).sort).toBe(sort);
      expect(parseProductQuery({ q: 'ao', sort }).sort).toBe(sort);
    },
  );

  test('reads sort=relevance while searching', () => {
    expect(parseProductQuery({ q: 'ao', sort: 'relevance' }).sort).toBe('relevance');
  });

  test('falls back to the newest first for sort=relevance without a search (AC20, AC22)', () => {
    expect(parseProductQuery({ sort: 'relevance' }).sort).toBe('newest');
  });

  test.each(['cheapest', 'PRICE_ASC', 'Newest', ''])(
    'falls back to the default sort for the wrong value %j, without an error (AC22)',
    (sort) => {
      expect(parseProductQuery({ sort }).sort).toBe('newest');
      expect(parseProductQuery({ q: 'ao', sort }).sort).toBe('relevance');
    },
  );
});

describe('productsHref', () => {
  test('leaves every default out of the URL', () => {
    expect(productsHref({ q: '', sort: 'newest', page: 1 })).toBe('/products');
    expect(productsHref({ q: 'ao', sort: 'relevance', page: 1 })).toBe('/products?q=ao');
  });

  test('writes the keyword, the sort and the page, in that order', () => {
    expect(productsHref({ q: 'ao thun', sort: 'price-asc', page: 2 })).toBe(
      '/products?q=ao+thun&sort=price-asc&page=2',
    );
  });

  test('writes a sort that is not the default for the search', () => {
    expect(productsHref({ q: '', sort: 'price-desc', page: 1 })).toBe('/products?sort=price-desc');
    expect(productsHref({ q: 'ao', sort: 'newest', page: 1 })).toBe('/products?q=ao&sort=newest');
  });

  test('encodes the keyword', () => {
    expect(productsHref({ q: 'áo & 100%', sort: 'relevance', page: 1 })).toBe(
      '/products?q=%C3%A1o+%26+100%25',
    );
  });

  test('reads back as the same query', () => {
    const query = { q: 'Áo thun', sort: 'price-asc', page: 3 } as const;
    const params = new URLSearchParams(productsHref(query).split('?')[1]);
    expect(parseProductQuery(Object.fromEntries(params))).toEqual(query);
  });
});

describe('searchHref', () => {
  test('searches from the first 24 products, sorted by relevance (S4.3, AC18)', () => {
    expect(searchHref({ q: '', sort: 'newest', page: 3 }, 'ao thun')).toBe('/products?q=ao+thun');
  });

  test('keeps a sort the visitor chose', () => {
    expect(searchHref({ q: '', sort: 'price-asc', page: 2 }, 'ao')).toBe(
      '/products?q=ao&sort=price-asc',
    );
    expect(searchHref({ q: 'ao', sort: 'newest', page: 1 }, 'quan')).toBe(
      '/products?q=quan&sort=newest',
    );
  });

  test('leaves the search with an empty keyword, back to the newest first', () => {
    expect(searchHref({ q: 'ao', sort: 'relevance', page: 2 }, '  ')).toBe('/products');
  });

  test('cleans the keyword as the page reads it', () => {
    expect(searchHref({ q: '', sort: 'newest', page: 1 }, '  ÁO   THUN ')).toBe(
      '/products?q=%C3%81O+THUN',
    );
  });
});

describe('foldKeyword', () => {
  // The cases of ProductSearchTermsTest of the api, which folds as app.search_fold does (ADR-0002).
  test.each([
    ['Áo thun cổ tròn', 'ao thun co tron'],
    ['ĐẦM Maxi đỏ 2026', 'dam maxi do 2026'],
    ['Quần jean (Nam) – Slim', 'quan jean nam slim'],
    ['  Bao   tay len  ', 'bao tay len'],
    ["100% cotton_x\\y'z", '100 cotton x y z'],
    ['jean-nam/2026', 'jean nam 2026'],
  ])('folds %j as the api does: %j', (q, folded) => {
    expect(foldKeyword(q)).toBe(folded);
  });

  test.each(['A', 'a', 'á', 'Á', 'a!', '!a', 'ả', '(a)', 'a a'])(
    'folds the variant %j of one search into the same words',
    (q) => {
      expect(foldKeyword(q)).toBe('a');
    },
  );

  test('keeps each word once, in the order of its first time', () => {
    expect(foldKeyword('thun Áo THUN ao co')).toBe('thun ao co');
  });

  test.each(['%', '_', '\\', "'", '!!!', '%%__', '–', '"\';--'])(
    'folds %j, a keyword with no word, into no word',
    (q) => {
      expect(foldKeyword(q)).toBe('');
    },
  );
});

describe('chosenSortOf', () => {
  test('gives no sort when the query has the default sort of its keyword', () => {
    expect(chosenSortOf({ q: '', sort: 'newest', page: 1 })).toBeNull();
    expect(chosenSortOf({ q: 'ao', sort: 'relevance', page: 2 })).toBeNull();
  });

  test('gives the sort the visitor chose, one other than the default of the keyword', () => {
    expect(chosenSortOf({ q: '', sort: 'price-asc', page: 1 })).toBe('price-asc');
    expect(chosenSortOf({ q: 'ao', sort: 'newest', page: 1 })).toBe('newest');
  });
});

describe('sortHref', () => {
  test('sorts the same search from the first 24 products (S4.4)', () => {
    expect(sortHref({ q: 'ao', sort: 'relevance', page: 2 }, 'price-asc')).toBe(
      '/products?q=ao&sort=price-asc',
    );
  });

  test('leaves the default sort out of the URL', () => {
    expect(sortHref({ q: '', sort: 'price-asc', page: 1 }, 'newest')).toBe('/products');
  });

  test('falls back to the default for relevance without a search', () => {
    expect(sortHref({ q: '', sort: 'price-asc', page: 1 }, 'relevance')).toBe('/products');
  });
});

describe('sortsFor', () => {
  test('offers relevance only while searching (S4.4, AC20)', () => {
    expect(sortsFor('')).toEqual(['newest', 'price-asc', 'price-desc']);
    expect(sortsFor('ao')).toEqual(['newest', 'price-asc', 'price-desc', 'relevance']);
  });
});

describe('apiSortOf', () => {
  test.each([
    ['newest', 'NEWEST'],
    ['price-asc', 'PRICE_ASC'],
    ['price-desc', 'PRICE_DESC'],
    ['relevance', 'RELEVANCE'],
  ] as const)('sends %s to the api as %s', (sort, api) => {
    expect(apiSortOf(sort)).toBe(api);
  });
});

describe('nextProductsHref', () => {
  const query = { q: '', sort: 'newest', page: 1 } as const;

  test('asks for the page after the one shown while products are left', () => {
    expect(nextProductsHref(query, { shown: 24, totalItems: 30, complete: true })).toBe(
      '/products?page=2',
    );
  });

  test('keeps the search and the sort (AC22)', () => {
    expect(
      nextProductsHref(
        { q: 'ao', sort: 'price-asc', page: 1 },
        { shown: 24, totalItems: 30, complete: true },
      ),
    ).toBe('/products?q=ao&sort=price-asc&page=2');
  });

  test('offers nothing once every product is shown', () => {
    expect(
      nextProductsHref({ ...query, page: 2 }, { shown: 30, totalItems: 30, complete: true }),
    ).toBeNull();
  });

  test('asks again for the page of the URL after a block failed', () => {
    expect(
      nextProductsHref({ ...query, page: 5 }, { shown: 96, totalItems: 300, complete: false }),
    ).toBe('/products?page=5');
  });
});

test('loads 24 products each time, a number 1, 2, 3 and 4 columns divide', () => {
  expect(PAGE_SIZE).toBe(24);
});
