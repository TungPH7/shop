'use client';

import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

/**
 * Hook seam S2 — query hooks sống ở `features/<x>/api/` (quy ước; component dùng HOOK, KHÔNG gọi
 * `fetch`/`useQuery` thẳng trong UI). Validate response Ở BIÊN bằng Zod (kỷ luật folder 13: `/api` cũng
 * là dữ liệu lạ vào client).
 */
const countResponseSchema = z.object({ count: z.number() });

async function fetchProductCount(): Promise<number> {
  const response = await fetch('/api/products/count');
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return countResponseSchema.parse(await response.json()).count;
}

export function useProductCount() {
  return useQuery({ queryKey: ['product-count'], queryFn: fetchProductCount });
}
