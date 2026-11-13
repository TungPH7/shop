// Type-safe `meta` for queries & mutations. Augmenting TanStack Query's
// `Register` interface turns `query.meta` / `mutation.meta` from an untyped
// `Record<string, unknown>` into this exact shape, so a typo in
// `meta: { skipGlobalError: true }` becomes a compile error and the global
// error handlers can read `meta.skipGlobalError` with full type-safety.
//
// The top-level `import` makes this a module (not an ambient global file), which
// is what lets the `declare module` augmentation merge correctly.
import '@tanstack/react-query';

// Must extend `Record<string, unknown>`: TanStack Query constrains the
// registered meta type to it (`queryMeta: infer T extends Record<string,unknown>`),
// and the index signature is what lets the augmentation replace the default
// while `skipGlobalError` stays a typed, dot-accessible property.
interface AppQueryMeta extends Record<string, unknown> {
  /**
   * Skip the global error toast (see global-error-handlers) for this
   * query/mutation. Use when the component renders the error itself and a toast
   * would only duplicate it. Reporting (captureError) still runs.
   */
  skipGlobalError?: boolean;
}

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: AppQueryMeta;
    mutationMeta: AppQueryMeta;
  }
}
