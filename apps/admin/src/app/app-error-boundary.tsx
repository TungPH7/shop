import { type ReactNode } from 'react';

import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';

import { ErrorFallback } from '@/components/feedback/error-fallback';
import { captureError } from '@/lib/monitoring/capture-error';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

// App-level (last-resort) error boundary. The route-level boundary (RouteError,
// folder 06) catches errors inside the routed tree and keeps the app shell; this
// one sits ABOVE the router and catches what escapes it — a crash in the root
// layout's own render, in the router itself, or anything a route boundary does
// not cover — so the user never sees a blank page.
//
// React error boundaries can ONLY be class components (getDerivedStateFromError
// / componentDidCatch — there is no hook equivalent). We use react-error-boundary
// (React-core-authored, tiny): typed Fallback, an `onReset` callback, and
// `useErrorBoundary` for throwing from async/event handlers (which class
// boundaries cannot catch). Wrapping it in QueryErrorResetBoundary makes "Try
// again" also reset failed queries, so the retry refetches instead of instantly
// replaying the cached error.
export function AppErrorBoundary({ children }: AppErrorBoundaryProps) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          FallbackComponent={ErrorFallback}
          onReset={reset}
          onError={(error, info) => {
            captureError(error, { source: 'react', componentStack: info.componentStack });
          }}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}
