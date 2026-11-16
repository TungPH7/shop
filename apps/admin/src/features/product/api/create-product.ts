import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';

import { productKeys } from '@/features/product/api/query-keys';
import { type CreateProductInput } from '@/features/product/model/product-form';
import { api } from '@/lib/api/api';
import { isApiError } from '@/lib/api/api-error';

// POST /api/admin/products (API Contract of docs/specs/SHOP-7/plan.md), for S2 in add
// mode (US2). A POST is never retried, by the api layer or here (NFR19).

/** What a 201 tells: the product is saved, and its id when the api gives it. */
export interface CreatedProduct {
  id: string | null;
}

const createdBodySchema = z.object({ id: z.string().min(1) });

function idOfLocation(location: unknown): string | null {
  if (typeof location !== 'string') return null;
  const id = location.split('/').filter(Boolean).at(-1);
  return id === undefined ? null : decodeURIComponent(id);
}

/**
 * A 2xx means saved. The id comes from `Location: /api/admin/products/{id}`, or else
 * from the body; a body that does not match AdminProduct is no failed save, which
 * would have the admin save again and add the product twice, with a slug `-2`.
 */
export async function createProduct(input: CreateProductInput): Promise<CreatedProduct> {
  // The Axios instance, not api.post: the id may be in a header. Its interceptors
  // still normalize every error into an ApiError.
  const response = await api.instance.post<unknown>('/admin/products', input);
  const body = createdBodySchema.safeParse(response.data);
  return { id: idOfLocation(response.headers['location']) ?? (body.success ? body.data.id : null) };
}

/**
 * The fields of the form that show an error of the api under them, in their order on
 * the form. Status and availability are a choice of two values: the api rejecting one
 * is a general error.
 */
export const PRODUCT_FORM_FIELDS = [
  'name',
  'slug',
  'description',
  'price',
  'compareAtPrice',
] as const;
export type ProductFormField = (typeof PRODUCT_FORM_FIELDS)[number];

/** How the form shows a failed save ("Cách admin hiện lỗi" of the API Contract). */
export type CreateProductError =
  /**
   * 400: an error under each field the api names, in their order on the form, so the
   * first is the one to focus (S2.6). The api lists them in no fixed order.
   */
  | { kind: 'fields'; fields: ProductFormField[] }
  /** 409 of a typed slug: "Slug này đã được dùng" under the slug (S2.7, AC8). */
  | { kind: 'slugTaken' }
  /**
   * 409 of slug null: every slug generated from the name, up to -1000, is taken. The
   * slug field was not typed, so "already in use" would not make sense there.
   */
  | { kind: 'slugNotGenerated' }
  /** Network, timeout, 5xx or anything else: the banner of S2.5. */
  | { kind: 'general' };

const validationProblemSchema = z.object({
  errors: z.array(z.object({ field: z.string() })),
});

/** Branches on the status and the code of the error, never on its message. */
export function createProductErrorOf(
  error: unknown,
  input: CreateProductInput,
): CreateProductError {
  if (!isApiError(error) || error.kind !== 'http') return { kind: 'general' };

  if (error.status === 409 && error.code === 'PRODUCT_SLUG_DUPLICATED') {
    return input.slug === null ? { kind: 'slugNotGenerated' } : { kind: 'slugTaken' };
  }

  if (error.status === 400) {
    const problem = validationProblemSchema.safeParse(error.details);
    const named = new Set(problem.success ? problem.data.errors.map((item) => item.field) : []);
    const fields = PRODUCT_FORM_FIELDS.filter((field) => named.has(field));
    if (fields.length > 0) return { kind: 'fields', fields };
  }

  return { kind: 'general' };
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProduct,
    // The form shows every error itself (S2.5, S2.6, S2.7): no global toast on top.
    meta: { skipGlobalError: true },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.lists() }),
  });
}
