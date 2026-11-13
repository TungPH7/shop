import { lazy, Suspense } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';

import { AppErrorBoundary } from '@/app/app-error-boundary';
import { router } from '@/app/router';
import { Notifications } from '@/components/feedback/notifications';
import { queryClient } from '@/lib/react-query/query-client';
import { StoreProvider } from '@/stores/store-provider';

// React Query Devtools: dev-only AND lazy. The conditional means that in a
// production build `import.meta.env.DEV` is `false`, the dynamic import becomes
// dead code, and the devtools are tree-shaken out entirely (Vercel
// `bundle-dynamic-imports` + `bundle-defer-third-party`).
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((module) => ({
        default: module.ReactQueryDevtools,
      })),
    )
  : null;

// Composition root for app-wide providers. StoreProvider (Redux, client state)
// wraps QueryClientProvider (server state); AppErrorBoundary (folder 12) then
// wraps the router as the last-resort net so a render crash never blanks the
// page. The nuqs adapter lives in the root layout (it needs React Router
// context). ThemeProvider (Phase 1.2) will wrap the visual layer around these.
export function AppProvider() {
  return (
    <StoreProvider>
      <QueryClientProvider client={queryClient}>
        <AppErrorBoundary>
          {/* Suspense catches react-i18next's initial "not ready" suspense (and any
              lazy namespace) so the first render never throws before i18n inits. */}
          <Suspense fallback={null}>
            <RouterProvider router={router} />
          </Suspense>
        </AppErrorBoundary>
        {/* Global notification surface — rendered OUTSIDE the boundary so it
            survives a crash and can still show e.g. a mutation-error toast even
            while the error fallback is on screen. */}
        <Notifications />
        {ReactQueryDevtools ? (
          <Suspense fallback={null}>
            <ReactQueryDevtools initialIsOpen={false} />
          </Suspense>
        ) : null}
      </QueryClientProvider>
    </StoreProvider>
  );
}
