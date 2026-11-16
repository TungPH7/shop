import { z } from 'zod';

// Products of the admin API, /api/admin/products: the API Contract of
// docs/specs/SHOP-7/plan.md. Zod is the source of truth at the boundary; the rest of
// the feature depends on these types, not on the JSON of the API.

export const productStatusSchema = z.enum(['ACTIVE', 'HIDDEN']);
export type ProductStatus = z.infer<typeof productStatusSchema>;

export const productAvailabilitySchema = z.enum(['IN_STOCK', 'OUT_OF_STOCK']);
export type ProductAvailability = z.infer<typeof productAvailabilitySchema>;

// A product of the admin list. The price is whole dong; a hidden product written
// before the Epic may be priced 0 or above 999.999.999 (NFR16), so no range here.
export const adminProductSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  price: z.number().int().nonnegative(),
  status: productStatusSchema,
  availability: productAvailabilitySchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type AdminProductSummary = z.infer<typeof adminProductSummarySchema>;

// Page<AdminProductSummary>: totalItems counts every product that matches the
// filters, not only those of the page.
export const adminProductPageSchema = z.object({
  items: z.array(adminProductSummarySchema),
  totalItems: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});
export type AdminProductPage = z.infer<typeof adminProductPageSchema>;

const priceNumber = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });
const NO_BREAK_SPACE = String.fromCodePoint(0xa0);

/**
 * A price as `1.250.000 ₫`, the same in both languages (design.md, component Giá).
 * A no-break space keeps the sign on the line of its number.
 */
export function formatPrice(price: number): string {
  return `${priceNumber.format(price)}${NO_BREAK_SPACE}₫`;
}

// The filters of the admin list as the URL holds them (S1.4, S1.5, S1.11):
// `?q=&status=all|active|hidden&page=N`. The API takes the status in upper case.
export const PRODUCT_STATUS_FILTERS = ['all', 'active', 'hidden'] as const;
export type ProductStatusFilter = (typeof PRODUCT_STATUS_FILTERS)[number];

export interface ProductListFilters {
  q: string;
  status: ProductStatusFilter;
  /** From 1. */
  page: number;
}
