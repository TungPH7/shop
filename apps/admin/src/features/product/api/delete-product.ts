import { useMutation, useQueryClient } from '@tanstack/react-query';

import { productKeys } from '@/features/product/api/query-keys';
import { api } from '@/lib/api/api';

// DELETE /api/admin/products/{id} (API Contract of docs/specs/SHOP-7/plan.md), for S3
// (US4). The api answers 204 even when the product is already gone, and the api layer
// never retries a write (NFR19): after a network error the person presses Delete
// again, and a delete that had in fact succeeded is no false error.

export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`/admin/products/${encodeURIComponent(id)}`);
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteProduct,
    // Send it even when the browser says it is offline: by default Query would pause
    // the delete until the network is back, with the dialog locked on "Deleting…" and
    // no way to cancel. Sent, it fails at once into the error of S3.6.
    networkMode: 'always',
    // The dialog shows the error itself (S3.6): no global toast on top.
    meta: { skipGlobalError: true },
    // Every page of the list, as the deleted product may shift the next ones.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: productKeys.lists() }),
  });
}
