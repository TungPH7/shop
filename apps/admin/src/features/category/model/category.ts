import { z } from 'zod';

import { isSlug, SLUG_MAX_LENGTH } from '@/lib/text/slug';

// Categories of the admin API, /api/admin/categories: the API Contract of
// docs/specs/SHOP-81/plan.md. Zod is the source of truth at the boundary; the rest of
// the feature depends on these types, not on the JSON of the API.
//
// Then the form of S2 and the body it sends: one schema for form and body (FM-002),
// its input what the fields hold, its output CreateCategoryInput, or the fields of
// UpdateCategoryInput without the version. It checks the Category Rules of the SPEC
// like CreateCategoryRequest and UpdateCategoryRequest of the api, which stay the final
// check. Lengths are UTF-16 units (`.length`), as `String.length()` of the api counts.

export const CATEGORY_STATUSES = ['VISIBLE', 'HIDDEN'] as const;
export const categoryStatusSchema = z.enum(CATEGORY_STATUSES);
export type CategoryStatus = z.infer<typeof categoryStatusSchema>;

/** The range of a display order, lower numbers first (docs/specs/SHOP-95, ADR-0006). */
export const DISPLAY_ORDER_MIN = 0;
export const DISPLAY_ORDER_MAX = 9999;

// One category, as POST, GET and PUT of /api/admin/categories/{id} answer. `version`
// goes back with an edit (NFR12). `displayOrder` is required: an answer without it, from
// an api of before SHOP-95 while a release rolls out, fails the load of S1 or S2 with Try
// again, never showing 0 in its place (NFR12 of docs/specs/SHOP-95/spec.md).
export const adminCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  status: categoryStatusSchema,
  displayOrder: z.number().int().min(DISPLAY_ORDER_MIN).max(DISPLAY_ORDER_MAX),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  version: z.number().int().nonnegative(),
});
export type AdminCategory = z.infer<typeof adminCategorySchema>;

// One row of the admin list: every product of the category, on sale or hidden (AC1, AC8).
export const adminCategoryListItemSchema = adminCategorySchema.extend({
  productCount: z.number().int().nonnegative(),
});
export type AdminCategoryListItem = z.infer<typeof adminCategoryListItemSchema>;

// ItemList<AdminCategoryListItem>: every category in one answer, in the order of the api,
// by display order, then by name as Vietnamese sorts it, then id (AC5 of SHOP-95, NFR17
// of SHOP-81). admin never sorts it again.
export const adminCategoryListSchema = z.object({
  items: z.array(adminCategoryListItemSchema),
});
export type AdminCategoryList = z.infer<typeof adminCategoryListSchema>;

export const CATEGORY_NAME_MAX_LENGTH = 60;

/** The slug the api gives a name with no letter or digit (AdminCategoryService.FALLBACK_SLUG). */
export const CATEGORY_SLUG_FALLBACK = 'danh-muc';

/** The error codes of the form; the component shows `form.errors.<code>`. */
export type CategoryFormError =
  | 'nameRequired'
  | 'nameTooLong'
  | 'slugFormat'
  | 'slugTooLong'
  | 'displayOrderRequired'
  | 'displayOrderInvalid';

const error = (message: CategoryFormError) => ({ message });

/** Digits 0–9 only: no sign, no separator, no fraction, no exponent (S2.3). */
const DIGITS = /^[0-9]+$/;

/**
 * The display order field of S2.3 of docs/specs/SHOP-95/design.md: the text as typed,
 * trimmed, then whole digits from 0 to 9999, sent as a number ("007" sends 7). Empty is
 * an error of its own, never read as 0; any other wrong value, -1, 10000, 1.5, 1,5 or
 * "abc", has the one message, and 1.5 is never rounded.
 */
const displayOrderFieldSchema = z
  .string()
  .trim()
  // `abort` stops at an empty field, so it has one error, the one asking for a number.
  .min(1, { ...error('displayOrderRequired'), abort: true })
  .refine(
    (text) => DIGITS.test(text) && Number(text) <= DISPLAY_ORDER_MAX,
    error('displayOrderInvalid'),
  )
  .transform(Number);

const categoryFieldsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, error('nameRequired'))
    .max(CATEGORY_NAME_MAX_LENGTH, error('nameTooLong')),
  slug: z.string(),
  /** Whether the admin typed the slug; until then the api generates it (S2.6). */
  slugEdited: z.boolean(),
  status: categoryStatusSchema,
  displayOrder: displayOrderFieldSchema,
});

type CategoryFields = z.output<typeof categoryFieldsSchema>;

/** The body the form gives, its slug typed as the mode sends it. */
interface CategoryBody<Slug extends string | null> {
  name: string;
  slug: Slug;
  status: CategoryStatus;
  /** Always sent, add and edit alike (plan of SHOP-95, Architecture Decisions 9). */
  displayOrder: number;
}

/**
 * The schema of the form, in add or edit mode: `checksSlug` tells whether the slug is
 * one to check, `slugOf` what the body sends.
 */
function categorySchema<Slug extends string | null>(
  checksSlug: (form: CategoryFields) => boolean,
  slugOf: (form: CategoryFields) => Slug,
) {
  return (
    categoryFieldsSchema
      // These checks sit on the object, after the fields; `when` runs them even if the
      // name is invalid, so every invalid field is reported at once (AC3).
      .refine((form) => !checksSlug(form) || form.slug.length <= SLUG_MAX_LENGTH, {
        ...error('slugTooLong'),
        path: ['slug'],
        when: () => true,
      })
      .refine(
        (form) => !checksSlug(form) || form.slug.length > SLUG_MAX_LENGTH || isSlug(form.slug),
        {
          ...error('slugFormat'),
          path: ['slug'],
          when: () => true,
        },
      )
      .transform(
        (form): CategoryBody<Slug> => ({
          name: form.name,
          slug: slugOf(form),
          status: form.status,
          displayOrder: form.displayOrder,
        }),
      )
  );
}

function isTypedSlug(form: { slug: string; slugEdited: boolean }): boolean {
  return form.slugEdited && form.slug !== '';
}

/**
 * Add mode: only a typed slug is checked; an empty one means "generate it" again, and
 * goes as null, so the api adds -2, -3… when the generated one is taken (AC4).
 */
export const categoryFormSchema = categorySchema(isTypedSlug, (form): string | null =>
  isTypedSlug(form) ? form.slug : null,
);

/**
 * Edit mode: the slug is required, always checked and always sent. A category has no
 * slug of before the Epic, so the saved one has the format too (UpdateCategoryRequest).
 */
export const categoryEditSchema = categorySchema(
  () => true,
  (form): string => form.slug,
);

/** What the fields of S2 hold. */
export type CategoryFormValues = z.input<typeof categoryFormSchema>;

/** CreateCategoryInput of the API Contract: the body of POST /api/admin/categories. */
export type CreateCategoryInput = z.output<typeof categoryFormSchema>;

/** The fields of an edit: those of an add, the slug always sent. */
export type CategoryEditInput = z.output<typeof categoryEditSchema>;

/** UpdateCategoryInput of the API Contract: the body of PUT /api/admin/categories/{id}. */
export interface UpdateCategoryInput extends CategoryEditInput {
  /** The version the form loaded: another one in the database is a conflict (NFR12). */
  version: number;
}

/** A new category: Visible (Category Rules), the slug generated, display order 0 (AC1). */
export const categoryFormDefaults: CategoryFormValues = {
  name: '',
  slug: '',
  slugEdited: false,
  status: 'VISIBLE',
  displayOrder: String(DISPLAY_ORDER_MIN),
};

/**
 * The fields of S2 in edit mode: the saved category, its slug counted as typed, its
 * display order in plain digits, 1000 and never 1.000 (S2.3, AC2).
 */
export function categoryFormValuesOf(category: AdminCategory): CategoryFormValues {
  return {
    name: category.name,
    slug: category.slug,
    slugEdited: true,
    status: category.status,
    displayOrder: String(category.displayOrder),
  };
}
