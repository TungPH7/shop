import { describe, expect, expectTypeOf, it } from 'vitest';
import { type z } from 'zod';

import {
  adminCategoryListSchema,
  adminCategorySchema,
  type AdminCategory,
  CATEGORY_NAME_MAX_LENGTH,
  categoryEditSchema,
  categoryFormDefaults,
  categoryFormSchema,
  categoryFormValuesOf,
  type CategoryFormValues,
} from '@/features/category/model/category';

// The categories of the admin API (API Contract of docs/specs/SHOP-81/plan.md) and the
// form of S2, which checks the Category Rules of docs/specs/SHOP-81/spec.md like
// CreateCategoryRequest and UpdateCategoryRequest of the api.

// The example of the API Contract, one item of GET /api/admin/categories.
const listItem = {
  id: '019a9c41-2b3d-7e10-8f2a-3c4d5e6f7a8b',
  name: 'Áo khoác',
  slug: 'ao-khoac',
  status: 'VISIBLE',
  productCount: 3,
  displayOrder: 0,
  createdAt: '2026-11-22T02:10:00.000Z',
  updatedAt: '2026-11-22T02:15:30.000Z',
  version: 0,
};

function values(overrides: Partial<CategoryFormValues> = {}): CategoryFormValues {
  return { ...categoryFormDefaults, name: 'Áo khoác nữ', ...overrides };
}

function errorsOf(schema: z.ZodType<unknown, CategoryFormValues>, input: CategoryFormValues) {
  const result = schema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
  );
}

describe('adminCategoryListSchema', () => {
  it('parses the example of the API Contract', () => {
    expect(adminCategoryListSchema.parse({ items: [listItem] })).toEqual({ items: [listItem] });
  });

  it('parses an empty list', () => {
    expect(adminCategoryListSchema.parse({ items: [] })).toEqual({ items: [] });
  });

  it('rejects an item with an unknown status or a negative count', () => {
    expect(
      adminCategoryListSchema.safeParse({ items: [{ ...listItem, status: 'GONE' }] }).success,
    ).toBe(false);
    expect(
      adminCategoryListSchema.safeParse({ items: [{ ...listItem, productCount: -1 }] }).success,
    ).toBe(false);
  });
});

describe('adminCategorySchema', () => {
  it('parses a category without a count, as POST, GET and PUT of one answer', () => {
    const category = { ...listItem } as Partial<typeof listItem>;
    delete category.productCount;

    expect(adminCategorySchema.parse(category)).toEqual(category);
  });

  it.each([0, 1, 9999])('reads the display order %d of the api', (displayOrder) => {
    expect(adminCategorySchema.parse({ ...listItem, displayOrder }).displayOrder).toBe(
      displayOrder,
    );
  });

  it('NFR12 rejects a category without a display order, from an api of before the Epic, never reading it as 0', () => {
    const category = { ...listItem } as Partial<typeof listItem>;
    delete category.displayOrder;

    expect(adminCategorySchema.safeParse(category).success).toBe(false);
    expect(adminCategoryListSchema.safeParse({ items: [category] }).success).toBe(false);
  });

  it.each([-1, 10000, 1.5, null, '3'])('rejects the display order %j', (displayOrder) => {
    expect(adminCategorySchema.safeParse({ ...listItem, displayOrder }).success).toBe(false);
  });
});

describe('categoryFormSchema', () => {
  it('starts Visible, with the slug generated', () => {
    expect(categoryFormDefaults).toEqual({
      name: '',
      slug: '',
      slugEdited: false,
      status: 'VISIBLE',
      displayOrder: '0',
    });
  });

  it('AC2 sends slug null while the slug was not typed, so the api generates it', () => {
    expect(categoryFormSchema.parse(values({ slug: 'ao-khoac-nu' }))).toEqual({
      name: 'Áo khoác nữ',
      slug: null,
      status: 'VISIBLE',
      displayOrder: 0,
    });
  });

  it('sends the slug typed by hand, and slug null once it is emptied', () => {
    expect(categoryFormSchema.parse(values({ slug: 'ao-nu', slugEdited: true })).slug).toBe(
      'ao-nu',
    );
    expect(categoryFormSchema.parse(values({ slug: '', slugEdited: true })).slug).toBeNull();
  });

  it('trims the name it sends', () => {
    expect(categoryFormSchema.parse(values({ name: '  Áo  ' })).name).toBe('Áo');
  });

  it('accepts a name of 60 characters once trimmed', () => {
    const name = ` ${'a'.repeat(CATEGORY_NAME_MAX_LENGTH)} `;

    expect(errorsOf(categoryFormSchema, values({ name }))).toEqual({});
  });

  describe('the invalid values of AC3', () => {
    it.each(['', '   '])('rejects the empty name %j', (name) => {
      expect(errorsOf(categoryFormSchema, values({ name }))).toEqual({ name: 'nameRequired' });
    });

    it('rejects a name of 61 characters', () => {
      expect(errorsOf(categoryFormSchema, values({ name: 'a'.repeat(61) }))).toEqual({
        name: 'nameTooLong',
      });
    });

    it.each(['Ao-khoac', 'áo-khoac', 'ao khoac', '-ao-khoac'])(
      'rejects the slug %s typed by hand',
      (slug) => {
        expect(errorsOf(categoryFormSchema, values({ slug, slugEdited: true }))).toEqual({
          slug: 'slugFormat',
        });
      },
    );

    it('rejects a slug of 101 characters typed by hand', () => {
      expect(
        errorsOf(categoryFormSchema, values({ slug: 'a'.repeat(101), slugEdited: true })),
      ).toEqual({ slug: 'slugTooLong' });
    });

    it('reports every invalid field at once', () => {
      expect(
        errorsOf(
          categoryFormSchema,
          values({ name: ' ', slug: 'A B', slugEdited: true, displayOrder: '-1' }),
        ),
      ).toEqual({ name: 'nameRequired', slug: 'slugFormat', displayOrder: 'displayOrderInvalid' });
    });
  });

  describe('the display order of S2.3', () => {
    it.each([
      ['0', 0],
      ['7', 7],
      [' 7 ', 7],
      ['007', 7],
      ['9999', 9999],
    ])('AC1 AC3 sends %j as the number %d', (displayOrder, sent) => {
      expect(categoryFormSchema.parse(values({ displayOrder })).displayOrder).toBe(sent);
    });

    it.each(['', '   '])(
      'AC3 asks for a display order when it is %j, never reading it as 0',
      (displayOrder) => {
        expect(errorsOf(categoryFormSchema, values({ displayOrder }))).toEqual({
          displayOrder: 'displayOrderRequired',
        });
      },
    );

    it.each(['-1', '10000', '1.5', '1,5', 'abc', '+5', '1e3', '٣', '99999999999999999999'])(
      'AC3 rejects the display order %j',
      (displayOrder) => {
        expect(errorsOf(categoryFormSchema, values({ displayOrder }))).toEqual({
          displayOrder: 'displayOrderInvalid',
        });
      },
    );
  });
});

const saved: AdminCategory = {
  id: listItem.id,
  name: 'Áo',
  slug: 'ao',
  status: 'VISIBLE',
  displayOrder: 3,
  createdAt: listItem.createdAt,
  updatedAt: listItem.updatedAt,
  version: 2,
};

describe('categoryFormValuesOf', () => {
  it('starts edit mode from the saved category, its slug counted as typed', () => {
    expect(categoryFormValuesOf(saved)).toEqual({
      name: 'Áo',
      slug: 'ao',
      slugEdited: true,
      status: 'VISIBLE',
      displayOrder: '3',
    });
  });

  it('writes the saved display order in plain digits, with no thousands separator', () => {
    expect(categoryFormValuesOf({ ...saved, displayOrder: 1000 }).displayOrder).toBe('1000');
  });
});

describe('categoryEditSchema', () => {
  it('AC5 keeps the slug when only the name changes', () => {
    expect(categoryEditSchema.parse({ ...categoryFormValuesOf(saved), name: 'Áo nam' })).toEqual({
      name: 'Áo nam',
      slug: 'ao',
      status: 'VISIBLE',
      displayOrder: 3,
    });
  });

  it('AC2 sends the new display order, the name, slug and status unchanged', () => {
    expect(categoryEditSchema.parse({ ...categoryFormValuesOf(saved), displayOrder: '0' })).toEqual(
      { name: 'Áo', slug: 'ao', status: 'VISIBLE', displayOrder: 0 },
    );
  });

  it.each(['', '-1', '10000', '1.5'])('AC3 rejects the display order %j', (displayOrder) => {
    expect(
      Object.keys(errorsOf(categoryEditSchema, { ...categoryFormValuesOf(saved), displayOrder })),
    ).toEqual(['displayOrder']);
  });

  it('types the display order of its body as a number, which add and edit always send', () => {
    expectTypeOf<z.output<typeof categoryEditSchema>['displayOrder']>().toEqualTypeOf<number>();
    expectTypeOf<z.output<typeof categoryFormSchema>['displayOrder']>().toEqualTypeOf<number>();
  });

  it('AC6 sends the new status', () => {
    expect(
      categoryEditSchema.parse({ ...categoryFormValuesOf(saved), status: 'HIDDEN' }).status,
    ).toBe('HIDDEN');
  });

  it('types the slug of its body as a string, which an edit always sends', () => {
    expectTypeOf<z.output<typeof categoryEditSchema>['slug']>().toEqualTypeOf<string>();
    expectTypeOf<z.output<typeof categoryFormSchema>['slug']>().toEqualTypeOf<string | null>();
  });

  it.each(['', 'Ao', 'áo', 'ao nam', '-ao'])('AC3 rejects the slug %j', (slug) => {
    expect(errorsOf(categoryEditSchema, { ...categoryFormValuesOf(saved), slug })).toEqual({
      slug: 'slugFormat',
    });
  });

  it('AC3 rejects an empty name and a name of 61 characters', () => {
    expect(errorsOf(categoryEditSchema, { ...categoryFormValuesOf(saved), name: ' ' })).toEqual({
      name: 'nameRequired',
    });
    expect(
      errorsOf(categoryEditSchema, { ...categoryFormValuesOf(saved), name: 'a'.repeat(61) }),
    ).toEqual({ name: 'nameTooLong' });
  });
});
