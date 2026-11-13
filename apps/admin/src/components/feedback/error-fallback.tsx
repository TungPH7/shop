import { type FallbackProps } from 'react-error-boundary';

import { isApiError } from '@/lib/api/api-error';

// Headless fallback shown by the app-level error boundary when a render crash
// escapes the router. UI-agnostic (Phase 1.1): plain, accessible markup; Phase
// 1.2 swaps in the styled version, this contract (error + reset) unchanged.
export function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  // react-error-boundary types `error` as `any`; treat it as unknown and narrow.
  const cause: unknown = error;
  const message = isApiError(cause)
    ? cause.message
    : cause instanceof Error
      ? cause.message
      : 'An unexpected error occurred';

  return (
    <section role="alert">
      <h2>Something went wrong</h2>
      <p>{message}</p>
      <button type="button" onClick={() => resetErrorBoundary()}>
        Try again
      </button>
    </section>
  );
}
