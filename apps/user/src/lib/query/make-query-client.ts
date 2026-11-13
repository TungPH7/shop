import { isServer, QueryClient } from '@tanstack/react-query';

/**
 * Seam S2 (TanStack Query) — server-cache phía CLIENT (data tương tác: refetch/realtime/infinite). RSC
 * + DAL lo data first-load (server); cái này cho client. `staleTime > 0` → tránh refetch ngay khi mount.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60_000 },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Mẫu official TanStack × Next: **server → client MỚI mỗi request** (không rò giữa request khi SSR);
 * **browser → singleton** (tránh tạo lại client khi component re-render/Suspense → mất cache).
 */
export function getQueryClient(): QueryClient {
  if (isServer) {
    return makeQueryClient();
  }
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
