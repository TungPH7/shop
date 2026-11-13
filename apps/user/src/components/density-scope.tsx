'use client';

import { type ReactNode } from 'react';

import { useDensity } from '~/stores/use-density';

/**
 * Bọc nội dung + áp `data-density` (CSS đổi spacing trong `globals.css`). Đọc state qua facade
 * `useDensity`; `children` vẫn server-rendered (chỉ wrapper là client) → giữ server-first.
 */
export function DensityScope({ children }: { children: ReactNode }) {
  const { density } = useDensity();
  return <div data-density={density}>{children}</div>;
}
