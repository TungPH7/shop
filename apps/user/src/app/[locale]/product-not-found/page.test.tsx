// @vitest-environment node
import { isValidElement, Suspense, type ReactElement, type ReactNode } from 'react';

import { expect, test, vi } from 'vitest';

import ProductNotFoundPage from './page';

// The page is rendered by Next (E2E, e2e/product-not-found.spec.ts); here its shape: it sets the locale of the path,
// then calls notFound() inside a <Suspense>, so its not-found boundary shows S6 with HTTP 404 when it is prerendered.
const { notFound, setRequestLocale } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  }),
  setRequestLocale: vi.fn(),
}));
vi.mock('next/navigation', () => ({ notFound }));
vi.mock('next-intl/server', () => ({ setRequestLocale }));

const pageOf = async (locale: string) =>
  (await ProductNotFoundPage({ params: Promise.resolve({ locale }) })) as ReactElement<{
    children: ReactNode;
  }>;

test('sets the locale of the path', async () => {
  await pageOf('vi');

  expect(setRequestLocale).toHaveBeenCalledWith('vi');
});

test('calls notFound() inside a <Suspense>, so the route answers 404 with S6', async () => {
  const page = await pageOf('vi');

  expect(page.type).toBe(Suspense);
  const signal = page.props.children;
  if (!isValidElement(signal)) throw new Error('no element');
  const render = signal.type as () => never;
  expect(() => render()).toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  expect(notFound).toHaveBeenCalledOnce();
});
