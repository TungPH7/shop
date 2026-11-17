import { z } from 'zod';

import {
  type AdminProduct,
  formatPrice,
  productAvailabilitySchema,
  productStatusSchema,
  type ProductAvailability,
  type ProductStatus,
} from '@/features/product/model/product';

// The form of S2 and the body of POST /api/admin/products (US2) or of
// PUT /api/admin/products/{id} (US3). One schema for form and body (FM-002): its input
// is what the fields hold, its output is CreateProductInput of the API Contract of
// docs/specs/SHOP-7/plan.md, which an edit sends with its `version`. It checks the
// Product Rules of the SPEC like the requests of the api, which stay the final check.
// Lengths are UTF-16 units (`.length`), as `String.length()` of the api counts them.

export const NAME_MAX_LENGTH = 150;
export const SLUG_MAX_LENGTH = 100;
export const DESCRIPTION_MAX_LENGTH = 5000;
export const PRICE_MAX = 999_999_999;

/** The slug the api gives a name with no letter or digit (ProductSlugs.FALLBACK). */
const SLUG_FALLBACK = 'san-pham';
const SLUG_FORMAT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** The accents NFD splits off a letter, as COMBINING_MARKS of ProductSlugs. */
const COMBINING_MARKS = /[\u0300-\u036f]/g;

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
    .replace(COMBINING_MARKS, '')
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

/** A price field read: the number it holds, empty, or the error to show under it. */
type PriceRead =
  | { kind: 'number'; value: number }
  | { kind: 'empty' }
  | { kind: 'error'; error: ProductFormError };

function readPrice(text: string, whenInvalid: ProductFormError): PriceRead {
  const price = parsePriceInput(text);
  if (price.kind === 'fraction') return { kind: 'error', error: 'priceWhole' };
  if (price.kind === 'invalid') return { kind: 'error', error: whenInvalid };
  if (price.kind === 'number' && price.value > PRICE_MAX) {
    return { kind: 'error', error: 'priceMax' };
  }
  return price;
}

function fail(ctx: z.RefinementCtx, message: ProductFormError): never {
  ctx.addIssue({ code: 'custom', message });
  return z.NEVER;
}

// The selling price is required: empty, 0 or not a number is "must be above 0" (S2.9).
const priceSchema = z.string().transform((text, ctx): number => {
  const price = readPrice(text, 'priceMin');
  if (price.kind === 'error') return fail(ctx, price.error);
  if (price.kind === 'empty' || price.value < 1) return fail(ctx, 'priceMin');
  return price.value;
});

// The compare-at price is optional: empty is none.
const compareAtPriceSchema = z.string().transform((text, ctx): number | null => {
  const price = readPrice(text, 'priceInvalid');
  if (price.kind === 'error') return fail(ctx, price.error);
  return price.kind === 'empty' ? null : price.value;
});

function isTypedSlug(form: { slug: string; slugEdited: boolean }): boolean {
  return form.slugEdited && form.slug !== '';
}

const productFieldsSchema = z.object({
  name: z.string().trim().min(1, error('nameRequired')).max(NAME_MAX_LENGTH, error('nameTooLong')),
  slug: z.string(),
  /** Whether the admin typed the slug; until then the api generates it (S2.7). */
  slugEdited: z.boolean(),
  description: z.string().max(DESCRIPTION_MAX_LENGTH, error('descriptionTooLong')),
  price: priceSchema,
  compareAtPrice: compareAtPriceSchema,
  status: productStatusSchema,
  availability: productAvailabilitySchema,
});

type ProductFields = z.output<typeof productFieldsSchema>;

/**
 * The schema of the form, in add or edit mode: `checksSlug` tells whether the slug is
 * one to check, `slugOf` what the body sends.
 */
function productSchema(
  checksSlug: (form: ProductFields) => boolean,
  slugOf: (form: ProductFields) => string | null,
) {
  return (
    productFieldsSchema
      // These checks read two fields, so they sit on the object; `when` runs them even
      // if another field is invalid, so every invalid field is reported at once (AC6).
      .refine((form) => !checksSlug(form) || form.slug.length <= SLUG_MAX_LENGTH, {
        ...error('slugTooLong'),
        path: ['slug'],
        when: () => true,
      })
      .refine(
        (form) =>
          !checksSlug(form) || form.slug.length > SLUG_MAX_LENGTH || SLUG_FORMAT.test(form.slug),
        { ...error('slugFormat'), path: ['slug'], when: () => true },
      )
      .refine((form) => form.compareAtPrice === null || form.compareAtPrice > form.price, {
        ...error('compareAtPriceGreater'),
        path: ['compareAtPrice'],
        // Only once both prices are valid numbers.
        when: ({ issues }) =>
          issues.every((issue) => !['price', 'compareAtPrice'].includes(String(issue.path?.[0]))),
      })
      .transform(
        (form): CreateProductInput => ({
          name: form.name,
          slug: slugOf(form),
          // Kept verbatim; empty or only white space is none, as the api stores it.
          description: form.description.trim() === '' ? null : form.description,
          price: form.price,
          compareAtPrice: form.compareAtPrice,
          status: form.status,
          availability: form.availability,
        }),
      )
  );
}

/**
 * Add mode (US2): only a typed slug is checked; an empty one means "generate it"
 * again, and goes as null.
 */
export const productFormSchema = productSchema(isTypedSlug, (form) =>
  isTypedSlug(form) ? form.slug : null,
);

/** Whether two slugs are the same for the api, which compares them ignoring case (citext). */
export function isSameSlug(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * Edit mode (US3): the slug is required and always sent. The saved slug, in any case,
 * is not checked, so an old product with a slug of a wrong format can still be saved
 * (NFR16, "Slug khi sửa" of the API Contract); any other slug is, an empty one too.
 */
export function productEditSchema(savedSlug: string) {
  return productSchema(
    (form) => !isSameSlug(form.slug, savedSlug),
    (form) => form.slug,
  );
}

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

/**
 * The fields of S2 in edit mode: the saved product, its prices grouped as the fields
 * show them once left (S2.9). The slug counts as typed, so it never follows the name.
 */
export function productFormValuesOf(product: AdminProduct): ProductFormValues {
  return {
    name: product.name,
    slug: product.slug,
    slugEdited: true,
    description: product.description ?? '',
    price: formatPrice(product.price, { sign: false }),
    compareAtPrice:
      product.compareAtPrice === null ? '' : formatPrice(product.compareAtPrice, { sign: false }),
    status: product.status,
    availability: product.availability,
  };
}
