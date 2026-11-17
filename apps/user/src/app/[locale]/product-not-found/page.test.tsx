// @vitest-environment node
import { createTranslator } from 'next-intl';
import { expect, test, vi } from 'vitest';

import en from '../../../../messages/en.json';
import vi_ from '../../../../messages/vi.json';

import ProductNotFoundPage, { generateMetadata } from './page';

// The page is rendered by Next (E2E, e2e/product-not-found.spec.ts); here what it does: it only calls notFound(), so its
// not-found boundary shows S6 with HTTP 404, already when the page is prerendered.
const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  }),
}));
vi.mock('next/navigation', () => ({ notFound }));
// getTranslations reads the real messages of the locale, as in products/page.test.tsx.
vi.mock('next-intl/server', () => ({
  getTranslations: ({ locale, namespace }: { locale: string; namespace: 'ProductNotFound' }) =>
    Promise.resolve(createTranslator({ locale, messages: locale === 'vi' ? vi_ : en, namespace })),
}));

test('calls notFound(), so the route answers 404 with S6', () => {
  expect(() => ProductNotFoundPage()).toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  expect(notFound).toHaveBeenCalledOnce();
});

test.each([
  ['vi', 'Không tìm thấy sản phẩm'],
  ['en', 'Product not found'],
])('titles the page in %s', async (locale, title) => {
  const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });

  expect(metadata.title).toBe(title);
});
