import { useMutation, useQueryClient } from '@tanstack/react-query';

import { productKeys } from '@/features/product/api/query-keys';
import { type NewProduct, type Product, productSchema } from '@/features/product/model/product';
import { api } from '@/lib/api/api';

export function createProduct(input: NewProduct): Promise<Product> {
  return api.post('/products', input, { schema: productSchema });
}

// Mutation + cache invalidation: after a successful create, mark the product
// lists stale so they refetch and show the new item.
export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    },
  });
}
