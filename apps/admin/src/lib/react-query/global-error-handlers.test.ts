import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api/api-error';
import { configureMonitoring, resetMonitoring } from '@/lib/monitoring/monitoring';
import { clearAll, getSnapshot } from '@/lib/notifications/notification-store';

import { handleMutationError, handleQueryError } from './global-error-handlers';

function makeClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({ onError: handleQueryError }),
    mutationCache: new MutationCache({ onError: handleMutationError }),
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

function toasted(substr: string): boolean {
  return getSnapshot().some((notification) => notification.message.includes(substr));
}

function rejectWith(message: string, status = 500): () => Promise<never> {
  return () => Promise.reject(new ApiError({ kind: 'http', status, message }));
}

describe('global error handlers', () => {
  beforeEach(() => {
    clearAll();
    // Silence the report path (default transport → console) for clean output.
    configureMonitoring({
      captureException: vi.fn(),
      captureMessage: vi.fn(),
      setUser: vi.fn(),
      addBreadcrumb: vi.fn(),
    });
  });
  afterEach(() => {
    clearAll();
    resetMonitoring();
  });

  it('does NOT toast an initial-load query error (no data yet)', async () => {
    const client = makeClient();
    await client
      .fetchQuery({ queryKey: ['fresh'], queryFn: rejectWith('fresh-err') })
      .catch(() => undefined);
    expect(toasted('fresh-err')).toBe(false);
  });

  it('toasts a background-refetch error (data already present)', async () => {
    const client = makeClient();
    client.setQueryData(['withdata'], { ok: true });
    await client
      .fetchQuery({ queryKey: ['withdata'], queryFn: rejectWith('bg-err', 503) })
      .catch(() => undefined);
    expect(toasted('bg-err')).toBe(true);
  });

  it('respects meta.skipGlobalError on a query', async () => {
    const client = makeClient();
    client.setQueryData(['skip'], { ok: true });
    await client
      .fetchQuery({
        queryKey: ['skip'],
        queryFn: rejectWith('skip-err'),
        meta: { skipGlobalError: true },
      })
      .catch(() => undefined);
    expect(toasted('skip-err')).toBe(false);
  });

  it('toasts a mutation error by default, and meta opts out', async () => {
    const client = makeClient();
    const mutations = client.getMutationCache();

    await mutations
      .build(client, { mutationFn: rejectWith('mut-err', 400) })
      .execute(undefined)
      .catch(() => undefined);
    expect(toasted('mut-err')).toBe(true);

    clearAll();
    await mutations
      .build(client, { mutationFn: rejectWith('mskip-err', 400), meta: { skipGlobalError: true } })
      .execute(undefined)
      .catch(() => undefined);
    expect(toasted('mskip-err')).toBe(false);
  });
});
