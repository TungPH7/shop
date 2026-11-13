'use client';

import { type ReactNode } from 'react';

import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { QueryProvider } from '~/lib/query/query-provider';
import { StoreProvider } from '~/stores/store-provider';

/**
 * Gom client seam cho VÙNG TƯƠNG TÁC products (folder 14): Redux S1 (`StoreProvider`) + TanStack S2
 * (`QueryProvider`) + nuqs (`NuqsAdapter`, URL state).
 *
 * ⭐ ĐẶT trong dynamic-hole (ProductResults bọc `<Suspense>` ở page) — KHÔNG ở root layout: các
 * provider này request-time (Redux seed `Math.random()` lúc load; nuqs đọc `useSearchParams`) → prerender
 * ở static shell sẽ vỡ cacheComponents (bài học Stage A). `children` vẫn server-render (provider client mỏng).
 */
export function ProductProviders({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <QueryProvider>
        <NuqsAdapter>{children}</NuqsAdapter>
      </QueryProvider>
    </StoreProvider>
  );
}
