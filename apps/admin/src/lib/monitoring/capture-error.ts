import { captureException } from './monitoring';

export interface ErrorContext {
  /** Where the error was caught — helps triage. */
  readonly source?: 'react' | 'route' | 'query' | 'mutation';
  readonly [key: string]: unknown;
}

// Thin app-facing wrapper kept from folder 12 so its call sites (the app error
// boundary, the route boundary, and the global Query/Mutation handlers) never
// change. The body now delegates to the monitoring seam — fulfilling the folder
// 12 promise that swapping the implementation is a one-file change. At deploy,
// `configureMonitoring(sentryTransport)` routes all of these to Sentry.
export function captureError(error: unknown, context: ErrorContext = {}): void {
  captureException(error, context);
}
