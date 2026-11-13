import { Link } from '~/i18n/navigation';

import {
  productQueryToParams,
  type ProductListQuery,
} from '~/features/product/model/product-query';

interface ProductPaginationProps {
  page: number;
  totalPages: number;
  query: ProductListQuery;
  labels: { prev: string; next: string; info: string };
}

/**
 * Phân trang server-render bằng `<Link>` locale-aware (`~/i18n/navigation`) — giữ filter hiện tại
 * (`productQueryToParams`) + đổi `page`. Server Component (no hook) → prefetch + chạy không-JS. `<= 1`
 * trang → ẩn; ở biên → nhãn không-link (giữ layout). page đã được backend kẹp trong [1, totalPages].
 */
export function ProductPagination({ page, totalPages, query, labels }: ProductPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  const hrefForPage = (target: number): string => {
    const params = new URLSearchParams(productQueryToParams(query));
    params.set('page', String(target));
    return `/products?${params.toString()}`;
  };

  return (
    <nav aria-label="pagination">
      {page > 1 ? (
        <Link href={hrefForPage(page - 1)}>{labels.prev}</Link>
      ) : (
        <span>{labels.prev}</span>
      )}{' '}
      <span role="status">{labels.info}</span>{' '}
      {page < totalPages ? (
        <Link href={hrefForPage(page + 1)}>{labels.next}</Link>
      ) : (
        <span>{labels.next}</span>
      )}
    </nav>
  );
}
