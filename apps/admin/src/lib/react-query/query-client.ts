import { type DefaultOptions, MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { handleMutationError, handleQueryError } from './global-error-handlers';

// Cache windows. staleTime > 0 means data stays "fresh" for a while, so
// re-mounting a screen within the window serves cache instead of refetching.
const STALE_TIME_MS = 60_000; // 1 minute
const GC_TIME_MS = 5 * 60_000; // 5 minutes before unused cache is collected

/**
 * What every write does, in the app and in the QueryClient of the tests
 * (createTestQueryClient), so a test of an offline browser sees what the app does.
 */
export const MUTATION_DEFAULTS = {
  // Never retried: a write that succeeded and lost its answer would be made twice.
  retry: false,
  // Every write is sent even when the browser says it is offline (NFR19 of
  // docs/specs/SHOP-7/spec.md). With the default 'online', Query would pause it:
  // the form or dialog stays locked on "Saving…" instead of showing its error,
  // and the write goes out by itself once the network is back, an automatic
  // retry NFR19 forbids. Sent, it fails at once into the error of the screen.
  // Write hooks never set networkMode themselves (ST-004). Reads keep the
  // default: a paused GET is harmless and refetches on reconnect.
  networkMode: 'always',
} as const satisfies DefaultOptions['mutations'];

export interface QueryClientOptions {
  /** Refetch on window focus — noisy while developing, useful in production. */
  refetchOnWindowFocus?: boolean;
}

// Factory kept env-free (testable): the env-derived flag is injected by the
// singleton below, mirroring the api-client factory/singleton split (folder 07).
export function createQueryClient(options: QueryClientOptions = {}): QueryClient {
  return new QueryClient({
    // Global, always-run error side effects (report + toast) live on the caches,
    // NOT in defaultOptions — defaultOptions can be overridden per call, cache
    // callbacks always fire exactly once. Per-call opt-out via
    // `meta.skipGlobalError`. See global-error-handlers.
    queryCache: new QueryCache({ onError: handleQueryError }),
    mutationCache: new MutationCache({ onError: handleMutationError }),
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        gcTime: GC_TIME_MS,
        // The API layer (folder 07) already retries transient failures with
        // backoff — Query must NOT retry on top, or attempts multiply. One
        // source of retry truth.
        retry: false,
        refetchOnWindowFocus: options.refetchOnWindowFocus ?? false,
        refetchOnReconnect: true,
      },
      mutations: { ...MUTATION_DEFAULTS },
    },
  });
}

// App-wide singleton. Tests build their own client via createQueryClient().
export const queryClient = createQueryClient({ refetchOnWindowFocus: !import.meta.env.DEV });
