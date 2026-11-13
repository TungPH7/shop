import { afterEach, expect, test, vi } from 'vitest';

// env.ts validates at import, so each test loads it again with its own VITE_API_URL.
async function loadEnv() {
  vi.resetModules();
  return (await import('./env')).env;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

test('the API base defaults to /api, so one build serves every environment', async () => {
  vi.stubEnv('VITE_API_URL', undefined);
  expect((await loadEnv()).apiUrl).toBe('/api');
});

test('an absolute URL is kept, for a machine that calls another API', async () => {
  vi.stubEnv('VITE_API_URL', 'https://api.example.test');
  expect((await loadEnv()).apiUrl).toBe('https://api.example.test');
});

test('a value that is neither a URL nor a path on this origin stops the app', async () => {
  vi.stubEnv('VITE_API_URL', '//api.example.test');
  await expect(loadEnv()).rejects.toThrow('[env] Invalid environment variables');
});
