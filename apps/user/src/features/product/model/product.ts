import * as z from 'zod';

/**
 * The products of the store, as the api of the customer returns them (plan of SHOP-7, API Contract, "API của khách"):
 * `GET /api/products/{slug}` (US6a), `GET /api/products` (US5a, US5b) and `GET /api/sitemap/products` (US6c). The api
 * returns only products that are on sale (NFR9), so the store has no status. Each schema keeps only the fields the pages
 * use (coding conventions 8.4).
 */

export const productAvailabilitySchema = z.enum(['IN_STOCK', 'OUT_OF_STOCK']);

export type ProductAvailability = z.infer<typeof productAvailabilitySchema>;

/** A price in whole dong (NFR14): never a fraction. */
const priceSchema = z.number().int().nonnegative();

export const storeProductSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  price: priceSchema,
  compareAtPrice: priceSchema.nullable(),
  availability: productAvailabilitySchema,
});

export type StoreProductSummary = z.infer<typeof storeProductSummarySchema>;

export const storeProductSchema = storeProductSummarySchema.extend({
  description: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});

export type StoreProduct = z.infer<typeof storeProductSchema>;

export const sitemapEntrySchema = z.object({
  slug: z.string(),
  updatedAt: z.iso.datetime(),
});

export type SitemapEntry = z.infer<typeof sitemapEntrySchema>;

const countSchema = z.number().int().nonnegative();

/** `Page<T>` of the API Contract: `totalItems` counts every match of the filter, not only this page. */
export function pageSchema<T extends z.ZodType>(item: T) {
  return z.object({
    items: z.array(item),
    totalItems: countSchema,
    offset: countSchema,
    limit: countSchema,
  });
}

/**
 * A slug the api can hold: `^[a-z0-9-]+$` since V3, compared without case (`citext`). Anything else, such as `..`, is no
 * product, so the DAL answers it without a request.
 */
export function isStoreSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/i.test(slug);
}

const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
});

/** 1250000 → "1.250.000 ₫". The space before ₫ is U+00A0, on the vi and the en pages alike (SPEC, Code Style). */
export function formatPrice(amount: number): string {
  return vnd.format(amount);
}

/** Rounded down, at least 1: 1.250.000 against 1.500.000 is 16. Integers before the division, so no float error. */
export function discountPercent(price: number, compareAtPrice: number): number {
  return Math.max(1, Math.floor(((compareAtPrice - price) * 100) / compareAtPrice));
}

/** The longest meta description of S5 (AC27). */
const META_DESCRIPTION_LENGTH = 160;

/**
 * The meta description of S5 (AC27): the first 160 characters of the description, each run of line breaks and spaces
 * folded into one space. Characters are code points, so a letter or an emoji is never cut in half. `null` when there is
 * no description, and the page then uses its own sentence. HTML stays text: the Metadata API of Next escapes it (NFR11).
 */
export function metaDescriptionOf(description: string | null): string | null {
  const folded = description?.replace(/\s+/g, ' ').trim();
  if (!folded) return null;
  return Array.from(folded).slice(0, META_DESCRIPTION_LENGTH).join('').trimEnd();
}
