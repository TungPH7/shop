import { z } from 'zod';

import { invariant } from '@/utils/assert';

// Schema-first: the Zod schema is the single source of truth and the TS type is
// inferred from it (locked convention: "Zod = single source of truth"). The same
// schema validates API responses at the boundary (see features/product/api).
export const productSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Price stored as integer cents to avoid floating-point money bugs. */
  priceCents: z.number().int().nonnegative(),
  inStock: z.boolean(),
});

export type Product = z.infer<typeof productSchema>;

// Input for creating a product: same shape minus the server-assigned id.
export const createProductSchema = productSchema.omit({ id: true });
export type NewProduct = z.infer<typeof createProductSchema>;

/** Format integer cents as a decimal string, e.g. 1999 -> "19.99". Pure. */
export function formatPriceFromCents(priceCents: number): string {
  invariant(Number.isInteger(priceCents), 'priceCents must be an integer');
  return (priceCents / 100).toFixed(2);
}
