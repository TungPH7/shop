import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { server } from '@/testing/msw/server';

import { createApiClient } from './api-client';
import { isApiError } from './api-error';

const BASE = 'http://localhost:3000';
const api = createApiClient({ baseURL: BASE });
const widgetSchema = z.object({ id: z.string(), name: z.string() });

// Integration: exercises the real interceptor pipeline (validate → retry →
// normalize) through MSW — the permanent form of folder 07's throwaway verify.
describe('createApiClient (integration via MSW)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns schema-validated data on success', async () => {
    server.use(http.get(`${BASE}/widget`, () => HttpResponse.json({ id: 'w1', name: 'Widget' })));
    await expect(api.get('/widget', { schema: widgetSchema })).resolves.toEqual({
      id: 'w1',
      name: 'Widget',
    });
  });

  it('throws ApiError(validation) when the body does not match the schema', async () => {
    server.use(http.get(`${BASE}/widget`, () => HttpResponse.json({ id: 123 })));
    await expect(api.get('/widget', { schema: widgetSchema })).rejects.toMatchObject({
      kind: 'validation',
    });
  });

  it('normalizes a non-retryable HTTP error to ApiError(http) with status', async () => {
    server.use(
      http.get(`${BASE}/missing`, () => HttpResponse.json({ message: 'Nope' }, { status: 404 })),
    );
    await api.get('/missing').then(
      () => {
        throw new Error('should have rejected');
      },
      (error: unknown) => {
        expect(isApiError(error)).toBe(true);
        expect(isApiError(error) && error.kind).toBe('http');
        expect(isApiError(error) && error.status).toBe(404);
      },
    );
  });

  it('retries an idempotent GET on a transient 500, then succeeds', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // zero backoff jitter → instant retry
    let calls = 0;
    server.use(
      http.get(`${BASE}/flaky`, () => {
        calls += 1;
        return calls === 1
          ? new HttpResponse(null, { status: 500 })
          : HttpResponse.json({ id: 'ok', name: 'Recovered' });
      }),
    );
    await expect(api.get('/flaky', { schema: widgetSchema })).resolves.toMatchObject({ id: 'ok' });
    expect(calls).toBe(2); // original + 1 retry
  });

  it('does NOT retry a non-idempotent POST on 500', async () => {
    let calls = 0;
    server.use(
      http.post(`${BASE}/things`, () => {
        calls += 1;
        return new HttpResponse(null, { status: 500 });
      }),
    );
    await expect(api.post('/things', {})).rejects.toMatchObject({ kind: 'http', status: 500 });
    expect(calls).toBe(1); // no retry for POST
  });
});
