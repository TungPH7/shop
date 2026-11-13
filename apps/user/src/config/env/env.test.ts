// @vitest-environment node
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

/**
 * Env TÁCH client/server (folder 15): `server.ts` `extends` `client.ts`. Test cả nhánh validate
 * hợp lệ lẫn fail-fast (thiếu/sai → throw lúc import). Dùng `@vitest-environment node` vì t3-env
 * coi môi trường có `window` là CLIENT → đọc biến server sẽ throw (jsdom có window).
 */
const VALID = {
  API_URL: 'https://api.example.test',
  NEXT_PUBLIC_SITE_URL: 'https://site.example.test',
  AUTH_SECRET: 'x'.repeat(32),
};

beforeEach(() => {
  vi.resetModules(); // để mỗi import chạy lại createEnv với process.env hiện tại
  for (const [key, value] of Object.entries(VALID)) vi.stubEnv(key, value);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

test('server env hợp lệ → đọc được cả biến server lẫn client (extends)', async () => {
  const { env } = await import('~/config/env/server');
  expect(env.API_URL).toBe(VALID.API_URL);
  expect(env.AUTH_SECRET).toBe(VALID.AUTH_SECRET);
  expect(env.NEXT_PUBLIC_SITE_URL).toBe(VALID.NEXT_PUBLIC_SITE_URL); // kế thừa từ clientEnv
});

test('clientEnv chỉ phơi biến công khai', async () => {
  const { clientEnv } = await import('~/config/env/client');
  expect(clientEnv.NEXT_PUBLIC_SITE_URL).toBe(VALID.NEXT_PUBLIC_SITE_URL);
});

test('the site URL defaults to the origin of Production, the same in every environment', async () => {
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
  const { clientEnv } = await import('~/config/env/client');
  expect(clientEnv.NEXT_PUBLIC_SITE_URL).toBe('https://shop.ao.t2g.io.vn');
});

test('next build needs no secret: the server checks them when it starts', async () => {
  vi.stubEnv('NEXT_PHASE', 'phase-production-build');
  vi.stubEnv('API_URL', '');
  vi.stubEnv('AUTH_SECRET', '');
  const { env } = await import('~/config/env/server');
  expect(env.API_URL).toBeUndefined();
});

test('API_URL sai định dạng → throw (fail-fast)', async () => {
  vi.stubEnv('API_URL', 'not-a-url');
  await expect(import('~/config/env/server')).rejects.toThrow();
});

test('AUTH_SECRET < 32 ký tự → throw', async () => {
  vi.stubEnv('AUTH_SECRET', 'too-short');
  await expect(import('~/config/env/server')).rejects.toThrow();
});

test('AUTH_SECRET rỗng (emptyStringAsUndefined → thiếu) → throw', async () => {
  vi.stubEnv('AUTH_SECRET', '');
  await expect(import('~/config/env/server')).rejects.toThrow();
});
