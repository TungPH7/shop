import { z } from 'zod';

import {
  productAvailabilitySchema,
  productStatusSchema,
  type ProductAvailability,
  type ProductStatus,
} from '@/features/product/model/product';

// The form of S2 (US2) and the body of POST /api/admin/products. One schema for both
// (FM-002): its input is what the fields hold, its output is CreateProductInput of the
// API Contract of docs/specs/SHOP-7/plan.md. It checks the Product Rules of the SPEC
// like CreateProductRequest of the api, which stays the final check. Lengths are
// UTF-16 units (`.length`), as `String.length()` of the api counts them.

export const NAME_MAX_LENGTH = 150;
export const SLUG_MAX_LENGTH = 100;
export const DESCRIPTION_MAX_LENGTH = 5000;
export const PRICE_MAX = 999_999_999;

/** The slug the api gives a name with no letter or digit (ProductSlugs.FALLBACK). */
const SLUG_FALLBACK = 'san-pham';
const SLUG_FORMAT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The slug the api generates from a name (ProductSlugs.fromName, Product Rules): no
 * Vietnamese accents, `đ` and `Đ` as `d`, lower case, each run of characters other
 * than a–z and 0–9 one hyphen, no hyphen at either end, cut at 100 characters without
 * a hyphen at the end. A blank name gives an empty slug, so the field stays empty.
 */
export function slugFromName(name: string): string {
  if (name.trim() === '') return '';
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/, '');
  return slug === '' ? SLUG_FALLBACK : slug;
}

export type PriceInput =
  | { kind: 'empty' }
  | { kind: 'number'; value: number }
  | { kind: 'fraction' }
  | { kind: 'invalid' };

const WHOLE = /^\d+$/;
const GROUPED = /^\d{1,3}(?:\.\d{3})+$/;
// A decimal part after a comma, or after a dot that does not group thousands.
const FRACTION = /^\d+(?:\.\d{3})*[,.]\d+$/;

/**
 * What a price field holds (Product Rules, "Ô giá trong admin"): the dot groups the
 * thousands, as Vietnamese writes them, so `250.000` is 250000; a decimal part, as
 * `250000,5`, is a fraction of a dong.
 */
export function parsePriceInput(text: string): PriceInput {
  const value = text.trim();
  if (value === '') return { kind: 'empty' };
  if (WHOLE.test(value) || GROUPED.test(value)) {
    return { kind: 'number', value: Number(value.replaceAll('.', '')) };
  }
  if (FRACTION.test(value)) return { kind: 'fraction' };
  return { kind: 'invalid' };
}

/** The error codes of the form; the component shows `form.errors.<code>`. */
export type ProductFormError =
  | 'nameRequired'
  | 'nameTooLong'
  | 'slugFormat'
  | 'slugTooLong'
  | 'descriptionTooLong'
  | 'priceMin'
  | 'priceWhole'
  | 'priceMax'
  | 'priceInvalid'
  | 'compareAtPriceGreater';

const error = (message: ProductFormError) => ({ message });

function priceField(whenEmptyOrInvalid: ProductFormError | null) {
  return z.string().transform((text, ctx): number | null => {
    const price = parsePriceInput(text);
    const fail = (message: ProductFormError) => {
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    };
    if (price.kind === 'fraction') return fail('priceWhole');
    if (price.kind === 'empty')
      return whenEmptyOrInvalid === null ? null : fail(whenEmptyOrInvalid);
    if (price.kind === 'invalid') return fail(whenEmptyOrInvalid ?? 'priceInvalid');
    if (price.value > PRICE_MAX) return fail('priceMax');
    return price.value;
  });
}

// The selling price is required: empty, 0 or not a number is "must be above 0" (S2.9).
const priceSchema = priceField('priceMin').refine(
  (price) => price !== null && price >= 1,
  error('priceMin'),
);

// The compare-at price is optional: empty is none.
const compareAtPriceSchema = priceField(null);

function isTypedSlug(form: { slug: string; slugEdited: boolean }): boolean {
  return form.slugEdited && form.slug !== '';
}

export const productFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, error('nameRequired'))
      .max(NAME_MAX_LENGTH, error('nameTooLong')),
    slug: z.string(),
    /** Whether the admin typed the slug; until then the api generates it (S2.7). */
    slugEdited: z.boolean(),
    description: z.string().max(DESCRIPTION_MAX_LENGTH, error('descriptionTooLong')),
    price: priceSchema,
    compareAtPrice: compareAtPriceSchema,
    status: productStatusSchema,
    availability: productAvailabilitySchema,
  })
  // A typed slug only; an empty one means "generate it" again. These checks read two
  // fields, so they sit on the object; `when` runs them even if another field is
  // invalid, so every invalid field is reported at once (AC6).
  .refine((form) => !isTypedSlug(form) || form.slug.length <= SLUG_MAX_LENGTH, {
    ...error('slugTooLong'),
    path: ['slug'],
    when: () => true,
  })
  .refine(
    (form) =>
      !isTypedSlug(form) || form.slug.length > SLUG_MAX_LENGTH || SLUG_FORMAT.test(form.slug),
    { ...error('slugFormat'), path: ['slug'], when: () => true },
  )
  .refine(
    (form) =>
      form.compareAtPrice === null || form.price === null || form.compareAtPrice > form.price,
    {
      ...error('compareAtPriceGreater'),
      path: ['compareAtPrice'],
      // Only once both prices are valid numbers.
      when: ({ issues }) =>
        issues.every((issue) => !['price', 'compareAtPrice'].includes(String(issue.path?.[0]))),
    },
  )
  .transform(
    (form): CreateProductInput => ({
      name: form.name,
      slug: isTypedSlug(form) ? form.slug : null,
      // Kept verbatim; empty or only white space is none, as the api stores it.
      description: form.description.trim() === '' ? null : form.description,
      price: form.price ?? 0,
      compareAtPrice: form.compareAtPrice,
      status: form.status,
      availability: form.availability,
    }),
  );

/** What the fields of S2 hold. */
export type ProductFormValues = z.input<typeof productFormSchema>;

/** CreateProductInput of the API Contract: the body of POST /api/admin/products. */
export interface CreateProductInput {
  name: string;
  /** null: the api generates it from the name, adding -2, -3… when taken. */
  slug: string | null;
  description: string | null;
  price: number;
  compareAtPrice: number | null;
  status: ProductStatus;
  availability: ProductAvailability;
}

/** A new product: Active and In stock (Product Rules), the slug generated. */
export const productFormDefaults: ProductFormValues = {
  name: '',
  slug: '',
  slugEdited: false,
  description: '',
  price: '',
  compareAtPrice: '',
  status: 'ACTIVE',
  availability: 'IN_STOCK',
};
