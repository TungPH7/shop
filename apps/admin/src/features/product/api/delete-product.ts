import { useMutation, useQueryClient } from '@tanstack/react-query';

import { productKeys } from '@/features/product/api/query-keys';
import { api } from '@/lib/api/api';

export function deleteProduct(productId: string): Promise<void> {
  return api.delete<void>(`/products/${productId}`);
}

// Mutation + cache cleanup: refresh the lists and drop the deleted product's
// detail cache so a stale entry can't resurface.
export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteProduct,
    onSuccess: (_data, productId) => {
      void queryClient.invalidateQueries({ queryKey: productKeys.lists() });
      queryClient.removeQueries({ queryKey: productKeys.detail(productId) });
    },
  });
}
