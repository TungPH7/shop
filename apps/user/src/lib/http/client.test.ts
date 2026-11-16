// @vitest-environment node
// client.ts đọc `env.API_URL` (biến SERVER). jsdom có `window` → t3-env tưởng CLIENT → đọc
// server-var sẽ THROW → chạy test ở `node` (không window) như env.test.ts (bài học folder 07).
import { http, HttpResponse } from 'msw';
import { afterEach, expect, test, vi } from 'vitest';
import { z } from 'zod';

import { ApiError } from '~/lib/http/api-error';
import { httpDelete, httpGet } from '~/lib/http/client';
import { server } from '~/testing/msw/server';

// `httpGet` đọc `env.API_URL` = 'https://api.example.test' trong Vitest (folder 07 `test.env`).
// MSW chặn fetch ở Node → test boundary thật (fetch → status → JSON → Zod → ApiError).
// (`import 'server-only'` trong client.ts được alias về stub no-op — xem vitest.config.)
const BASE = 'https://api.example.test';
const schema = z.object({ ok: z.boolean() });
const msgSchema = z.object({ message: z.string() });

afterEach(() => {
  vi.unstubAllEnvs();
});

test('GET hợp lệ → trả data đã validate', async () => {
  server.use(http.get(`${BASE}/ping`, () => HttpResponse.json({ ok: true })));
  await expect(httpGet('/ping', schema)).resolves.toEqual({ ok: true });
});

test('status không-2xx → ApiError kind=http + status', async () => {
  server.use(http.get(`${BASE}/boom`, () => new HttpResponse(null, { status: 500 })));
  await expect(httpGet('/boom', schema)).rejects.toBeInstanceOf(ApiError);
  await expect(httpGet('/boom', schema)).rejects.toMatchObject({ kind: 'http', status: 500 });
});

test('body sai shape → ApiError kind=validation', async () => {
  server.use(http.get(`${BASE}/bad`, () => HttpResponse.json({ ok: 'nope' })));
  await expect(httpGet('/bad', schema)).rejects.toMatchObject({ kind: 'validation' });
});

// --- DELETE (folder 12: dùng cho mutation qua DAL) -----------------------------
test('DELETE hợp lệ → trả message đã validate', async () => {
  server.use(http.delete(`${BASE}/items/1`, () => HttpResponse.json({ message: 'deleted' })));
  await expect(httpDelete('/items/1', msgSchema)).resolves.toEqual({ message: 'deleted' });
});

test('DELETE 401 → ApiError kind=http status=401 (isAuthError)', async () => {
  server.use(http.delete(`${BASE}/items/1`, () => new HttpResponse(null, { status: 401 })));
  await expect(httpDelete('/items/1', msgSchema)).rejects.toMatchObject({
    kind: 'http',
    status: 401,
  });
});

test('forward init.headers (auth seam folder 15) xuống fetch', async () => {
  let authHeader: string | null = null;
  server.use(
    http.delete(`${BASE}/items/1`, ({ request }) => {
      authHeader = request.headers.get('authorization');
      return HttpResponse.json({ message: 'ok' });
    }),
  );
  await httpDelete('/items/1', msgSchema, { headers: { Authorization: 'Bearer t' } });
  expect(authHeader).toBe('Bearer t');
});

// --- Base URL and time limit (plan of SHOP-7, Architecture Decisions 12; NFR26) ----------------
test('builds the URL with new URL, so an API_URL ending in /api does not double it', async () => {
  vi.resetModules();
  vi.stubEnv('API_URL', 'https://api.example.test/api');
  let hits = 0;
  server.use(
    http.get(`${BASE}/api/products`, () => {
      hits += 1;
      return HttpResponse.json({ ok: true });
    }),
  );
  const client = await import('~/lib/http/client');

  await expect(client.httpGet('/api/products', schema)).resolves.toEqual({ ok: true });
  expect(hits).toBe(1);
});

test('reaches the same URL when API_URL has no /api', async () => {
  server.use(http.get(`${BASE}/api/products`, () => HttpResponse.json({ ok: true })));
  await expect(httpGet('/api/products', schema)).resolves.toEqual({ ok: true });
});

test('gives every request a time limit of 5 seconds', async () => {
  const timeout = vi.spyOn(AbortSignal, 'timeout');
  server.use(http.get(`${BASE}/ping`, () => HttpResponse.json({ ok: true })));

  await httpGet('/ping', schema);

  expect(timeout).toHaveBeenCalledWith(5000);
});

test('a request past its time limit → ApiError kind=timeout', async () => {
  vi.spyOn(AbortSignal, 'timeout').mockReturnValue(
    AbortSignal.abort(new DOMException('The operation timed out.', 'TimeoutError')),
  );
  server.use(http.get(`${BASE}/slow`, () => HttpResponse.json({ ok: true })));

  await expect(httpGet('/slow', schema)).rejects.toMatchObject({ kind: 'timeout' });
});

test('a request that reaches no server → ApiError kind=network', async () => {
  server.use(http.get(`${BASE}/down`, () => HttpResponse.error()));

  await expect(httpGet('/down', schema)).rejects.toMatchObject({ kind: 'network' });
});

test('a body that is not JSON → ApiError kind=validation', async () => {
  server.use(
    http.get(
      `${BASE}/broken`,
      () => new HttpResponse('{"ok": tru', { headers: { 'Content-Type': 'application/json' } }),
    ),
  );

  await expect(httpGet('/broken', schema)).rejects.toMatchObject({
    kind: 'validation',
    message: 'Response was not valid JSON',
  });
});

test('a time limit reached while the body is read → ApiError kind=timeout', async () => {
  const response = new Response('{"ok": true}', { status: 200 });
  vi.spyOn(response, 'json').mockRejectedValue(
    new DOMException('The operation timed out.', 'TimeoutError'),
  );
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

  await expect(httpGet('/slow-body', schema)).rejects.toMatchObject({ kind: 'timeout' });
});
