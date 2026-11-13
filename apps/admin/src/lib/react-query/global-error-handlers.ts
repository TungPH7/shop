import { type DefaultError, type Mutation, type Query, type QueryKey } from '@tanstack/react-query';

import { normalizeError } from '@/lib/api/api-error';
import { captureError } from '@/lib/monitoring/capture-error';
import { notify } from '@/lib/notifications/notification-store';

// Global server-state error handling, attached to the QueryCache / MutationCache
// (see query-client). Unlike `defaultOptions`, cache-level callbacks ALWAYS run
// once per query/mutation and cannot be overridden — the correct home for
// cross-cutting side effects (report + toast).
//
// This replaces two anti-patterns seen in reference projects: a `toast.error`
// duplicated inside every mutation hook, and a `toast.error` inside the axios
// response interceptor (our API layer stays pure transport — folder 07/§11).
// Opt out per call with `meta: { skipGlobalError: true }` (typed in query-meta.d.ts).

export function handleQueryError(
  error: DefaultError,
  query: Query<unknown, unknown, unknown, QueryKey>,
): void {
  // Always report — observability must never be silenced.
  captureError(error, { source: 'query', queryKey: query.queryKey });

  if (query.meta?.skipGlobalError === true) {
    return;
  }

  // Only surface BACKGROUND refetch failures (there is already data on screen).
  // Initial-load errors are handled by the component (isError, folder 08) or
  // bubble to an error boundary — a toast on top of that would be noise.
  if (query.state.data !== undefined) {
    notify.error(normalizeError(error).message);
  }
}

export function handleMutationError(
  error: DefaultError,
  _variables: unknown,
  _context: unknown,
  mutation: Mutation<unknown, unknown, unknown, unknown>,
): void {
  captureError(error, { source: 'mutation' });

  // Mutations are user-initiated writes, so a failure almost always deserves
  // feedback — toast by default, unless the caller opts out via meta.
  if (mutation.meta?.skipGlobalError === true) {
    return;
  }
  notify.error(normalizeError(error).message);
}
