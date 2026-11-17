// @vitest-environment node
import { isValidElement, Suspense, type ReactElement, type ReactNode } from 'react';

import { afterEach, expect, test, vi } from 'vitest';

import ProductNotFoundPage from './page';

// The page is rendered by Next (E2E, e2e/product-not-found.spec.ts); here what it does: it only calls notFound(), so its
// not-found boundary shows S6 with HTTP 404. Where it calls it depends on how Next renders it: see the page.
const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  }),
}));
vi.mock('next/navigation', () => ({ notFound }));

afterEach(() => {
  vi.unstubAllEnvs();
});

test('in a build, calls notFound() inside a <Suspense>, so the prerender keeps S6 with 404', () => {
  vi.stubEnv('NODE_ENV', 'production');

  const page = ProductNotFoundPage() as ReactElement<{ children: ReactNode }>;

  expect(page.type).toBe(Suspense);
  expect(notFound).not.toHaveBeenCalled();
  const signal = page.props.children;
  if (!isValidElement(signal)) throw new Error('no element');
  const render = signal.type as () => never;
  expect(() => render()).toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  expect(notFound).toHaveBeenCalledOnce();
});

test('under next dev, calls notFound() at once, so the page answers 404 there too', () => {
  vi.stubEnv('NODE_ENV', 'development');

  expect(() => ProductNotFoundPage()).toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  expect(notFound).toHaveBeenCalledOnce();
});
