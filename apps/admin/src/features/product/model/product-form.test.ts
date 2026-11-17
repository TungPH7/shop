import { describe, expect, expectTypeOf, it } from 'vitest';
import { type z } from 'zod';

import { type AdminProduct } from '@/features/product/model/product';
import {
  parsePriceInput,
  productEditSchema,
  productFormDefaults,
  productFormSchema,
  productFormValuesOf,
  type ProductFormValues,
  slugFromName,
} from '@/features/product/model/product-form';

// The form of S2 (US2) checks the Product Rules of docs/specs/SHOP-7/spec.md, like
// CreateProductRequest and ProductSlugs of the api.

function values(overrides: Partial<ProductFormValues> = {}): ProductFormValues {
  return { ...productFormDefaults, name: 'Đầm maxi đỏ', price: '450000', ...overrides };
}

function errorsOf(input: ProductFormValues): Record<string, string> {
  const result = productFormSchema.safeParse(input);
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
  );
}

describe('slugFromName', () => {
  it.each([
    ['Áo thun cổ tròn', 'ao-thun-co-tron'],
    ['Đầm maxi đỏ 2026', 'dam-maxi-do-2026'],
    ['Quần jean (Nam) – Slim', 'quan-jean-nam-slim'],
    ['Đầm maxi đỏ', 'dam-maxi-do'],
  ])('turns the example of the Product Rules %s into %s', (name, slug) => {
    expect(slugFromName(name)).toBe(slug);
  });

  it('removes accents written as separate combining marks (NFD)', () => {
    expect(slugFromName('Áo thun')).toBe('ao-thun');
  });

  it('drops hyphens at either end and joins every run of other characters into one hyphen', () => {
    expect(slugFromName('  --Áo   thun!!  ')).toBe('ao-thun');
  });

  it('cuts at 100 characters and drops a hyphen the cut leaves at the end', () => {
    const name = `${'a'.repeat(99)} b`;

    expect(slugFromName(name)).toBe('a'.repeat(99));
  });

  it('is san-pham for a name with no letter or digit, as the api', () => {
    expect(slugFromName('!!!')).toBe('san-pham');
  });

  it('is empty while the name is blank, so the slug field stays empty', () => {
    expect(slugFromName('   ')).toBe('');
  });
});

describe('parsePriceInput', () => {
  it.each([
    ['450000', 450000],
    ['250.000', 250000],
    ['1.250.000', 1250000],
    ['  450000 ', 450000],
    ['999.999.999', 999999999],
  ])('reads %s as %d dong, the dot grouping thousands', (text, value) => {
    expect(parsePriceInput(text)).toEqual({ kind: 'number', value });
  });

  it('reads an empty field as empty', () => {
    expect(parsePriceInput('  ')).toEqual({ kind: 'empty' });
  });

  it.each(['250000,5', '450000.5', '1.250,75', '250.5'])(
    'reads %s as a price with a fraction',
    (text) => {
      expect(parsePriceInput(text)).toEqual({ kind: 'fraction' });
    },
  );

  it.each(['abc', '-5', '12a', '1..000', '+5'])('reads %s as not a number', (text) => {
    expect(parsePriceInput(text)).toEqual({ kind: 'invalid' });
  });
});

describe('productFormSchema', () => {
  it('starts Active and In stock, with the slug generated', () => {
    expect(productFormDefaults).toMatchObject({
      status: 'ACTIVE',
      availability: 'IN_STOCK',
      slugEdited: false,
    });
  });

  it('turns valid values into the body of POST /api/admin/products', () => {
    const result = productFormSchema.parse(
      values({
        name: '  Đầm maxi đỏ  ',
        slug: 'dam-maxi-do',
        description: 'Dòng 1\nDòng 2',
        price: '450.000',
        compareAtPrice: '500.000',
        status: 'HIDDEN',
        availability: 'OUT_OF_STOCK',
      }),
    );

    expect(result).toEqual({
      name: 'Đầm maxi đỏ',
      slug: null,
      description: 'Dòng 1\nDòng 2',
      price: 450000,
      compareAtPrice: 500000,
      status: 'HIDDEN',
      availability: 'OUT_OF_STOCK',
    });
  });

  it('sends slug null while the slug was not edited by hand, so the api generates it', () => {
    expect(productFormSchema.parse(values({ slug: 'dam-maxi-do' })).slug).toBeNull();
  });

  it('sends the slug typed by hand', () => {
    const result = productFormSchema.parse(values({ slug: 'dam-do', slugEdited: true }));

    expect(result.slug).toBe('dam-do');
  });

  it('sends slug null when the slug typed by hand was emptied', () => {
    expect(productFormSchema.parse(values({ slug: '', slugEdited: true })).slug).toBeNull();
  });

  it('sends no compare-at price and no description when they are empty', () => {
    const result = productFormSchema.parse(values({ compareAtPrice: ' ', description: '  \n ' }));

    expect(result.compareAtPrice).toBeNull();
    expect(result.description).toBeNull();
  });

  it('keeps the description verbatim, tags included', () => {
    const description = '  <b>Mới</b> < 5 cm\n';

    expect(productFormSchema.parse(values({ description })).description).toBe(description);
  });

  describe('the invalid values of AC6', () => {
    it('rejects an empty name', () => {
      expect(errorsOf(values({ name: '   ' }))).toEqual({ name: 'nameRequired' });
    });

    it('rejects a name of 151 characters, and takes one of 150', () => {
      expect(errorsOf(values({ name: 'a'.repeat(151) }))).toEqual({ name: 'nameTooLong' });
      expect(errorsOf(values({ name: ` ${'a'.repeat(150)} ` }))).toEqual({});
    });

    it.each(['Ao-thun', 'áo-thun', 'ao thun', '-ao-thun', 'ao--thun', 'ao-thun-'])(
      'rejects the slug %s typed by hand',
      (slug) => {
        expect(errorsOf(values({ slug, slugEdited: true }))).toEqual({ slug: 'slugFormat' });
      },
    );

    it('rejects a slug of 101 characters typed by hand', () => {
      expect(errorsOf(values({ slug: 'a'.repeat(101), slugEdited: true }))).toEqual({
        slug: 'slugTooLong',
      });
    });

    it.each(['', '0', '0.000', 'abc', '-5'])('rejects the price %j', (price) => {
      expect(errorsOf(values({ price }))).toEqual({ price: 'priceMin' });
    });

    it('rejects a price with a fraction', () => {
      expect(errorsOf(values({ price: '450000,5' }))).toEqual({ price: 'priceWhole' });
    });

    it('rejects a price over 999.999.999', () => {
      expect(errorsOf(values({ price: '1.000.000.000' }))).toEqual({ price: 'priceMax' });
    });

    it.each(['450000', '400.000'])(
      'rejects a compare-at price %s not above the price',
      (compareAtPrice) => {
        expect(errorsOf(values({ price: '450000', compareAtPrice }))).toEqual({
          compareAtPrice: 'compareAtPriceGreater',
        });
      },
    );

    it('rejects a compare-at price with a fraction, over the maximum or not a number', () => {
      expect(errorsOf(values({ compareAtPrice: '500000,5' }))).toEqual({
        compareAtPrice: 'priceWhole',
      });
      expect(errorsOf(values({ compareAtPrice: '1.000.000.000' }))).toEqual({
        compareAtPrice: 'priceMax',
      });
      expect(errorsOf(values({ compareAtPrice: 'abc' }))).toEqual({
        compareAtPrice: 'priceInvalid',
      });
    });

    it('rejects a description of 5.001 characters, and takes one of 5.000', () => {
      expect(errorsOf(values({ description: 'a'.repeat(5001) }))).toEqual({
        description: 'descriptionTooLong',
      });
      expect(errorsOf(values({ description: 'a'.repeat(5000) }))).toEqual({});
    });

    it('reports every invalid field at once', () => {
      expect(
        Object.keys(
          errorsOf(
            values({ name: '', slug: 'A B', slugEdited: true, description: 'a'.repeat(5001) }),
          ),
        ).sort(),
      ).toEqual(['description', 'name', 'slug']);
    });

    it('reports a typed slug even when the price is invalid too', () => {
      expect(errorsOf(values({ price: 'abc', slug: 'Ao Thun', slugEdited: true }))).toEqual({
        price: 'priceMin',
        slug: 'slugFormat',
      });
    });
  });
});

// S2 in edit mode (US3): the form starts from the saved product, and checks the slug
// only when it differs from the saved one, as PUT /api/admin/products/{id} does (NFR16).
const saved: AdminProduct = {
  id: '019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f',
  name: 'Áo thun cổ tròn',
  slug: 'ao-thun-co-tron',
  description: 'Áo thun cotton 100%.\nCổ tròn, tay ngắn.',
  price: 250000,
  compareAtPrice: null,
  status: 'ACTIVE',
  availability: 'IN_STOCK',
  createdAt: '2026-11-16T02:10:00.000Z',
  updatedAt: '2026-11-16T02:15:30.000Z',
  version: 3,
};

describe('productFormValuesOf', () => {
  it('fills the fields with the saved product, its prices grouped as the fields show them', () => {
    expect(productFormValuesOf({ ...saved, price: 200000, compareAtPrice: 1250000 })).toEqual({
      name: 'Áo thun cổ tròn',
      slug: 'ao-thun-co-tron',
      slugEdited: true,
      description: 'Áo thun cotton 100%.\nCổ tròn, tay ngắn.',
      price: '200.000',
      compareAtPrice: '1.250.000',
      status: 'ACTIVE',
      availability: 'IN_STOCK',
    });
  });

  it('leaves the description and the compare-at price empty when the product has none', () => {
    const form = productFormValuesOf({ ...saved, description: null, compareAtPrice: null });

    expect(form.description).toBe('');
    expect(form.compareAtPrice).toBe('');
  });
});

describe('productEditSchema', () => {
  const schema = productEditSchema(saved.slug);

  function editErrorsOf(input: ProductFormValues, of = schema): Record<string, string> {
    const result = of.safeParse(input);
    if (result.success) return {};
    return Object.fromEntries(
      result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
    );
  }

  it('AC9 turns the edited fields into the body of PUT, keeping the slug', () => {
    const form = {
      ...productFormValuesOf(saved),
      name: 'Áo thun cổ tròn basic',
      price: '200000',
      compareAtPrice: '250000',
    };

    expect(schema.parse(form)).toEqual({
      name: 'Áo thun cổ tròn basic',
      slug: 'ao-thun-co-tron',
      description: 'Áo thun cotton 100%.\nCổ tròn, tay ngắn.',
      price: 200000,
      compareAtPrice: 250000,
      status: 'ACTIVE',
      availability: 'IN_STOCK',
    });
  });

  it('types the slug of its body as a string, which an edit always sends', () => {
    expectTypeOf<z.output<typeof schema>['slug']>().toEqualTypeOf<string>();
    expectTypeOf<z.output<typeof productFormSchema>['slug']>().toEqualTypeOf<string | null>();
  });

  it('AC12 sends a new slug in the right format', () => {
    expect(schema.parse({ ...productFormValuesOf(saved), slug: 'ao-thun-basic' }).slug).toBe(
      'ao-thun-basic',
    );
  });

  it('does not check the format of the saved slug, as an old product may have a wrong one (NFR16)', () => {
    const old = productEditSchema('Ao_Thun Cu');

    expect(old.parse({ ...productFormValuesOf(saved), slug: 'Ao_Thun Cu' }).slug).toBe(
      'Ao_Thun Cu',
    );
    expect(old.parse({ ...productFormValuesOf(saved), slug: 'ao_thun cu' }).slug).toBe(
      'ao_thun cu',
    );
  });

  it('checks the format and the length of a slug that differs from the saved one', () => {
    expect(editErrorsOf({ ...productFormValuesOf(saved), slug: 'Ao-Thun-Basic' })).toEqual({
      slug: 'slugFormat',
    });
    expect(editErrorsOf({ ...productFormValuesOf(saved), slug: 'a'.repeat(101) })).toEqual({
      slug: 'slugTooLong',
    });
  });

  it('rejects an empty slug, which an edit cannot generate', () => {
    expect(editErrorsOf({ ...productFormValuesOf(saved), slug: '' })).toEqual({
      slug: 'slugFormat',
    });
  });

  it('asks a new price of an old product priced 0 (Product Rules)', () => {
    expect(editErrorsOf(productFormValuesOf({ ...saved, price: 0 }))).toEqual({
      price: 'priceMin',
    });
  });

  it('reports every invalid field at once, the slug included', () => {
    expect(
      editErrorsOf({ ...productFormValuesOf(saved), name: ' ', slug: '-x', price: '0' }),
    ).toEqual({ name: 'nameRequired', slug: 'slugFormat', price: 'priceMin' });
  });
});
