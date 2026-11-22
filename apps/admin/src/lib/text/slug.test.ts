import { describe, expect, it } from 'vitest';

import { isSameSlug, isSlug, SLUG_MAX_LENGTH, slugFromName } from '@/lib/text/slug';

// The slug rules shared by products and categories: the Product Rules of
// docs/specs/SHOP-7/spec.md, which the Category Rules of docs/specs/SHOP-81/spec.md take
// as they are, like Slugs of the api.

const FALLBACK = 'fallback';

describe('slugFromName', () => {
  it.each([
    ['Áo thun cổ tròn', 'ao-thun-co-tron'],
    ['Đầm maxi đỏ 2026', 'dam-maxi-do-2026'],
    ['Quần jean (Nam) – Slim', 'quan-jean-nam-slim'],
    ['Áo khoác nữ', 'ao-khoac-nu'],
  ])('turns the example of the rules %s into %s', (name, slug) => {
    expect(slugFromName(name, FALLBACK)).toBe(slug);
  });

  it('removes accents written as separate combining marks (NFD)', () => {
    expect(slugFromName('Áo thun', FALLBACK)).toBe('ao-thun');
  });

  it('drops hyphens at either end and joins every run of other characters into one hyphen', () => {
    expect(slugFromName('  --Áo   thun!!  ', FALLBACK)).toBe('ao-thun');
  });

  it('cuts at 100 characters and drops a hyphen the cut leaves at the end', () => {
    expect(slugFromName(`${'a'.repeat(99)} b`, FALLBACK)).toBe('a'.repeat(99));
  });

  it('is the fallback of its kind for a name with no letter or digit, as the api', () => {
    expect(slugFromName('!!!', 'san-pham')).toBe('san-pham');
    expect(slugFromName('!!!', 'danh-muc')).toBe('danh-muc');
  });

  it('is empty while the name is blank, so the slug field stays empty', () => {
    expect(slugFromName('   ', FALLBACK)).toBe('');
  });
});

describe('isSlug', () => {
  it.each(['ao', 'ao-thun-2', '2026', 'a'.repeat(SLUG_MAX_LENGTH)])('accepts %s', (slug) => {
    expect(isSlug(slug)).toBe(true);
  });

  it.each(['', 'Ao', 'áo', 'ao thun', '-ao', 'ao-', 'ao--thun', 'a'.repeat(SLUG_MAX_LENGTH + 1)])(
    'rejects %j',
    (slug) => {
      expect(isSlug(slug)).toBe(false);
    },
  );
});

describe('isSameSlug', () => {
  it('compares two slugs ignoring case, as citext of the api', () => {
    expect(isSameSlug('ao', 'AO')).toBe(true);
    expect(isSameSlug('ao', 'ao-nam')).toBe(false);
  });
});
