// @vitest-environment node
import { isValidElement, Suspense, type ReactElement, type ReactNode } from 'react';

import { createTranslator } from 'next-intl';
import { afterEach, expect, test, vi } from 'vitest';

import en from '../../../../messages/en.json';
import vi_ from '../../../../messages/vi.json';

import CategoryNotFoundPage, { generateMetadata } from './page';

// The page is rendered by Next (E2E, e2e/category-page.spec.ts); here what it does: it only calls notFound(), so its
// not-found boundary shows S6 with HTTP 404, as /[locale]/product-not-found does (SHOP-24).
const { notFound } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_HTTP_ERROR_FALLBACK;404');
  }),
}));
vi.mock('next/navigation', () => ({ notFound }));
vi.mock('next-intl/server', () => ({
  getTranslations: ({ locale, namespace }: { locale: string; namespace: 'CategoryNotFound' }) =>
    Promise.resolve(createTranslator({ locale, messages: locale === 'vi' ? vi_ : en, namespace })),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

test('in a build, calls notFound() inside a <Suspense>, so the prerender keeps S6 with 404', () => {
  vi.stubEnv('NODE_ENV', 'production');

  const page = CategoryNotFoundPage() as ReactElement<{ children: ReactNode }>;

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

  expect(() => CategoryNotFoundPage()).toThrow('NEXT_HTTP_ERROR_FALLBACK;404');
  expect(notFound).toHaveBeenCalledOnce();
});

test.each([
  ['vi', 'Không tìm thấy danh mục'],
  ['en', 'Category not found'],
])(
  'titles S6 in %s for the template of the root layout, with no canonical nor hreflang',
  async (locale, title) => {
    const metadata = await generateMetadata({ params: Promise.resolve({ locale }) });

    expect(metadata).toEqual({ title });
  },
);
