import { useEffect } from 'react';

import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { paths } from '@/config/paths';
import { captureError } from '@/lib/monitoring/capture-error';

// Route-level error boundary (RouteObject.ErrorBoundary). Catches render and
// loader/action errors INSIDE the routed tree so a thrown error shows a
// recoverable screen (keeping the app shell) instead of a blank page.
//
// Two-tier strategy (folder 12): this handles errors within routes; the
// app-level AppErrorBoundary catches what escapes the router (e.g. a crash in
// the root layout's own render). Both report through the same captureError seam.
export function RouteError() {
  const error = useRouteError();

  // Report route-level errors through the shared seam (folder 13 wires the real
  // logger). Re-runs only when the caught error identity changes.
  useEffect(() => {
    captureError(error, { source: 'route' });
  }, [error]);

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unexpected error';

  return (
    <section role="alert">
      <h2>Something went wrong</h2>
      <p>{message}</p>
      <Link to={paths.home.getHref()}>Go home</Link>
    </section>
  );
}
