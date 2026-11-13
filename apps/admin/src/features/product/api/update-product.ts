import { useMutation, useQueryClient } from '@tanstack/react-query';

import { productKeys } from '@/features/product/api/query-keys';
import { type NewProduct, type Product, productSchema } from '@/features/product/model/product';
import { api } from '@/lib/api/api';

// PUT = full replace, so the body reuses the SAME shape as create (NewProduct) —
// schema-first reuse, no separate update schema to drift.
export function updateProduct(productId: string, input: NewProduct): Promise<Product> {
  return api.put(`/products/${productId}`, input, { schema: productSchema });
}

// Mutation + cache update: refresh the lists AND seed the detail cache with the
// server's response so the detail page shows the new values instantly.
export function useUpdateProduct(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: NewProduct) => updateProduct(productId, input),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      queryClient.setQueryData(productKeys.detail(productId), updated);
    },
  });
}
