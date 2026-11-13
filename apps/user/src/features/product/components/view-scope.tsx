'use client';

import { type ReactNode } from 'react';

import { useQueryState } from 'nuqs';

import { VIEW_QUERY_KEY, viewParser } from '~/features/product/model/product-view';

/**
 * Đọc `?view` (nuqs, CÙNG key/parser với `ViewToggle`) → áp `data-view` (CSS đổi layout grid/list trong
 * `globals.css`). `children` vẫn server-rendered (chỉ wrapper là client). Song song `DensityScope`
 * (data-density từ Redux) → 1 list, 2 nguồn state độc lập: URL (nuqs) + persisted (Redux).
 */
export function ViewScope({ children }: { children: ReactNode }) {
  const [view] = useQueryState(VIEW_QUERY_KEY, viewParser);
  return <div data-view={view}>{children}</div>;
}
