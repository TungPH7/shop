// Hierarchical query-key factory (the widely-used "TkDodo" pattern). One place
// owns the key shape, so keys never drift and invalidation is precise:
//   - invalidate `productKeys.all`     → every product query
//   - invalidate `productKeys.lists()` → just the lists
//   - invalidate `productKeys.detail(id)` → one product
export const productKeys = {
  all: ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  details: () => [...productKeys.all, 'detail'] as const,
  detail: (productId: string) => [...productKeys.details(), productId] as const,
};
