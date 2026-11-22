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
});

describe('categoryFormSchema', () => {
  it('starts Visible, with the slug generated', () => {
    expect(categoryFormDefaults).toEqual({
      name: '',
      slug: '',
      slugEdited: false,
      status: 'VISIBLE',
    });
  });

  it('AC2 sends slug null while the slug was not typed, so the api generates it', () => {
    expect(categoryFormSchema.parse(values({ slug: 'ao-khoac-nu' }))).toEqual({
      name: 'Áo khoác nữ',
      slug: null,
      status: 'VISIBLE',
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
        errorsOf(categoryFormSchema, values({ name: ' ', slug: 'A B', slugEdited: true })),
      ).toEqual({ name: 'nameRequired', slug: 'slugFormat' });
    });
  });
});

const saved: AdminCategory = {
  id: listItem.id,
  name: 'Áo',
  slug: 'ao',
  status: 'VISIBLE',
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
    });
  });
});

describe('categoryEditSchema', () => {
  it('AC5 keeps the slug when only the name changes', () => {
    expect(categoryEditSchema.parse({ ...categoryFormValuesOf(saved), name: 'Áo nam' })).toEqual({
      name: 'Áo nam',
      slug: 'ao',
      status: 'VISIBLE',
    });
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
