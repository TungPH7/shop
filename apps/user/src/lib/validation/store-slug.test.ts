import { describe, expect, test } from 'vitest';

import { isStoreSlug } from './store-slug';

describe('isStoreSlug', () => {
  test.each(['ao-thun-co-tron', 'AO-THUN-CO-TRON', 'combo-3-ao', '-a--b-', 'ao', 'AO'])(
    'accepts %s',
    (slug) => {
      expect(isStoreSlug(slug)).toBe(true);
    },
  );

  // `..`, `/` (a `%2F` decoded) and `%` (a malformed escape left as typed) would lead to another path of the api (NFR9).
  test.each(['', '..', 'ao thun', 'áo-thun', 'a/b', 'a%2Fb', '%E0', '../admin/categories'])(
    'rejects %j',
    (slug) => {
      expect(isStoreSlug(slug)).toBe(false);
    },
  );
});
