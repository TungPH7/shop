import { createTranslator } from 'next-intl';
import { describe, expect, test } from 'vitest';

import en from '../../../../messages/en.json';
import vi from '../../../../messages/vi.json';

import { categoryDescriptionOf, categoryTitleOf, TITLE_SUFFIX } from './category-seo';

// The tiers of the SEO section of the SPEC of SHOP-81 (S5), with the real messages of each locale.
const MESSAGES = { vi, en } as const;

function seoOf(locale: 'vi' | 'en', name: string) {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'Category' });
  return {
    title: categoryTitleOf(name, [t('titleLong', { name }), t('titleShort', { name })]),
    description: categoryDescriptionOf(
      t('metaDescription1', { name }),
      t('metaDescription2', { name }),
    ),
  };
}

/** The title as the browser shows it, with the suffix the template of the root layout adds. */
const shown = (title: string) => `${title}${TITLE_SUFFIX}`;

test('the suffix of the template of the root layout is " · tungph7 codebase", 19 characters', () => {
  expect(TITLE_SUFFIX).toBe(' · tungph7 codebase');
  expect(TITLE_SUFFIX).toHaveLength(19);
});

describe('categoryTitleOf (AC18)', () => {
  test('picks tier 1 for "Áo khoác" in vi: 60 characters with the suffix, the example of the SPEC', () => {
    const { title } = seoOf('vi', 'Áo khoác');

    expect(shown(title)).toBe('Áo khoác – Xem giá và tình trạng còn hàng · tungph7 codebase');
    expect(shown(title)).toHaveLength(60);
  });

  test('picks tier 1 for "Jackets" in en: 56 characters with the suffix, the example of the SPEC', () => {
    const { title } = seoOf('en', 'Jackets');

    expect(shown(title)).toBe('Jackets – See prices and stock status · tungph7 codebase');
    expect(shown(title)).toHaveLength(56);
  });

  test.each([
    ['vi', 'a'.repeat(8), 'titleLong'],
    ['vi', 'a'.repeat(9), 'titleShort'],
    ['vi', 'a'.repeat(21), 'titleShort'],
    ['en', 'a'.repeat(11), 'titleLong'],
    ['en', 'a'.repeat(12), 'titleShort'],
    ['en', 'a'.repeat(22), 'titleShort'],
  ] as const)('in %s, a name of %s characters takes %s', (locale, name, key) => {
    const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'Category' });

    expect(seoOf(locale, name).title).toBe(t(key, { name }));
  });

  test.each(['vi', 'en'] as const)(
    'in %s, a name too long for tier 2 is the title alone, never cut nor padded',
    (locale) => {
      const name = 'Quần áo thể thao nam nữ cao cấp chính hãng giá tốt';

      expect(seoOf(locale, name).title).toBe(name);
    },
  );

  test.each(['vi', 'en'] as const)(
    'in %s, a title is never over 60 characters with the suffix while the name has under 42',
    (locale) => {
      for (let length = 1; length < 42; length += 1) {
        expect(shown(seoOf(locale, 'x'.repeat(length)).title).length).toBeLessThanOrEqual(60);
      }
    },
  );

  test('keeps a name holding markup as text, for the Metadata API of Next to escape (NFR10)', () => {
    const name = '</script><script>alert(1)</script>';

    expect(seoOf('vi', name).title).toBe(name);
  });
});

describe('categoryDescriptionOf (AC18)', () => {
  test('joins both sentences for "Áo khoác" in vi, under 160 characters', () => {
    const { description } = seoOf('vi', 'Áo khoác');

    expect(description).toBe(
      'Áo khoác: xem giá, tình trạng còn hàng và chi tiết từng sản phẩm đang bán tại cửa hàng. Sắp xếp theo giá hoặc mới nhất, rồi chọn ngay sản phẩm bạn cần.',
    );
    expect(description.length).toBeLessThanOrEqual(160);
  });

  test('joins both sentences for "Jackets" in en: 151 characters, the example of the SPEC', () => {
    const { description } = seoOf('en', 'Jackets');

    expect(description).toBe(
      'Jackets: see prices, stock status and details for every product currently on sale in the shop. Sort by price or newest, then pick the product you need.',
    );
    expect(description).toHaveLength(151);
  });

  test.each(['vi', 'en'] as const)(
    'in %s, keeps only the first sentence when both would pass 160 characters',
    (locale) => {
      const name = 'a'.repeat(40);
      const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'Category' });

      expect(seoOf(locale, name).description).toBe(t('metaDescription1', { name }));
    },
  );

  test('joins both sentences for "Áo khoác" in vi: 151 characters, the example of the SPEC', () => {
    expect(seoOf('vi', 'Áo khoác').description).toHaveLength(151);
  });

  // At the limit: both sentences are the name and 143 characters in vi, 144 in en.
  test.each([
    ['vi', 17, 'both sentences, 160 characters', 160],
    ['vi', 18, 'the first sentence only', 18 + 79],
    ['en', 16, 'both sentences, 160 characters', 160],
    ['en', 17, 'the first sentence only', 17 + 87],
  ] as const)('in %s, a name of %i characters takes %s', (locale, length, _, expected) => {
    const name = 'x'.repeat(length);

    expect(seoOf(locale, name).description).toHaveLength(expected);
  });

  test.each(['vi', 'en'] as const)(
    'in %s, starts with the name and never passes 160 characters',
    (locale) => {
      for (let length = 1; length <= 60; length += 1) {
        const name = 'x'.repeat(length);
        const { description } = seoOf(locale, name);

        expect(description.startsWith(`${name}:`)).toBe(true);
        expect(description.length).toBeLessThanOrEqual(160);
      }
    },
  );
});
