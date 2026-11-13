'use client';

import { useProductCount } from '~/features/product/api/use-product-count';

interface ProductCountBadgeProps {
  labels: { total: string; loading: string; error: string; refresh: string };
}

/**
 * Badge tổng số sản phẩm — demo seam S2 (TanStack Query): server-state TƯƠNG TÁC phía client (fetch sau
 * hydrate qua Route Handler `/api/products/count`). RSC lo first-load của trang; cái này minh hoạ client
 * cache/refetch (+ devtools). Dùng HOOK `useProductCount`, KHÔNG gọi fetch thẳng trong UI.
 */
export function ProductCountBadge({ labels }: ProductCountBadgeProps) {
  const { data, isPending, isError, isFetching, refetch } = useProductCount();

  let text: string;
  if (isPending) {
    text = labels.loading;
  } else if (isError) {
    text = labels.error;
  } else {
    text = `${labels.total}: ${data ?? '—'}`;
  }

  return (
    <p role="status">
      {text}{' '}
      <button type="button" onClick={() => void refetch()} disabled={isFetching}>
        {labels.refresh}
      </button>
    </p>
  );
}
