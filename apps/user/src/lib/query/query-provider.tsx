'use client';

import { type ReactNode } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { getQueryClient } from '~/lib/query/make-query-client';

/**
 * Provider seam S2 (`'use client'`). Đặt TRONG dynamic-hole (như StoreProvider — bài học cacheComponents
 * Stage A: không prerender provider client-state ở static shell). `getQueryClient` lo server/browser.
 * `ReactQueryDevtools` tự render `null` ở production (chỉ hiện khi dev) → an toàn để nguyên.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
