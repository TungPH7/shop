import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  createProductErrorOf,
  type CreateProductError,
} from '@/features/product/api/create-product';
import { productKeys } from '@/features/product/api/query-keys';
import { type AdminProduct, adminProductSchema } from '@/features/product/model/product';
import { type CreateProductInput } from '@/features/product/model/product-form';
import { api } from '@/lib/api/api';
import { isApiError } from '@/lib/api/api-error';

// PUT /api/admin/products/{id} (API Contract of docs/specs/SHOP-7/plan.md), for S2 in
// edit mode (US3). A PUT is never retried, by the api layer or here (NFR19): the retry
// of one that succeeded and lost its answer would get a false conflict.

/** UpdateProductInput of the API Contract: every field, the slug too, and the version. */
export interface UpdateProductInput extends CreateProductInput {
  slug: string;
  /** The version the form loaded: another one in the database is a conflict (AC13). */
  version: number;
}

export interface UpdateProductVariables {
  id: string;
  input: UpdateProductInput;
}

export function updateProduct({ id, input }: UpdateProductVariables): Promise<AdminProduct> {
  return api.put(`/admin/products/${encodeURIComponent(id)}`, input, {
    schema: adminProductSchema,
  });
}

/** How the form shows a failed edit ("Cách admin hiện lỗi" of the API Contract). */
export type UpdateProductError =
  | Exclude<CreateProductError, { kind: 'slugNotGenerated' }>
  /** 409 OPTIMISTIC_LOCK_CONFLICT: the conflict banner of S2.5, nothing written (AC13). */
  | { kind: 'conflict' }
  /** 404: deleted since it was opened; the not-found state of S2.3. */
  | { kind: 'notFound' };

/** Branches on the status and the code of the error, never on its message. */
export function updateProductErrorOf(error: unknown): UpdateProductError {
  if (isApiError(error) && error.kind === 'http') {
    if (error.status === 409 && error.code === 'OPTIMISTIC_LOCK_CONFLICT') {
      return { kind: 'conflict' };
    }
    if (error.status === 404) return { kind: 'notFound' };
  }
  // An edit always sends a slug, so a taken one is never one the api generated.
  const failure = createProductErrorOf(error, { slug: '' });
  return failure.kind === 'slugNotGenerated' ? { kind: 'slugTaken' } : failure;
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateProduct,
    // The form shows every error itself (S2.3, S2.5, S2.7): no global toast on top.
    meta: { skipGlobalError: true },
    // The list shows the new name, price and labels. The product itself loads anew
    // each time the form opens (productQueryOptions).
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.lists() }),
  });
}
