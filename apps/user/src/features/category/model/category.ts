import * as z from 'zod';

/**
 * The categories of the store, as the api of the customer returns them (plan of SHOP-81, API Contract, "API danh mục
 * của khách"): `GET /api/categories` (S7, AC17), `GET /api/categories/{slug}` (S5, AC12–AC16) and
 * `GET /api/sitemap/categories` (AC19). The api returns only visible categories (NFR8), so the store has no status,
 * and a shopper never sees how many products a category holds. Each schema keeps only the fields the pages use.
 */

export const storeCategorySchema = z.object({
  name: z.string(),
  /** The stored slug, whatever case the path asked for: the canonical and the links use it (AC18). */
  slug: z.string(),
});

export type StoreCategory = z.infer<typeof storeCategorySchema>;

/** `ItemList<T>` of the API Contract: a whole list in one response, with no page (NFR1). */
export function itemListSchema<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item) });
}

export const categorySitemapEntrySchema = z.object({
  slug: z.string(),
  /** The later of the last edit of the category and of its products on sale, computed by the api (AC19). */
  updatedAt: z.iso.datetime(),
});

export type CategorySitemapEntry = z.infer<typeof categorySitemapEntrySchema>;
