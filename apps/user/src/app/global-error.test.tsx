// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test, vi } from 'vitest';

import GlobalError from './global-error';

// global-error.tsx replaces the root layout when the layout itself fails, with its own <html>. When that happens on the
// server, Next sends only the CSS that global-error.tsx imports, so it must load the same stylesheets and set the same
// font as the layout: without tokens.css, `outline: 2px solid var(--ring)` of :focus-visible is invalid and the button
// loses its focus ring (WCAG 2.4.7), and without --font-sans the page falls back to the serif of the browser.
// next/font only runs in the build of Next: the font is a stub.
vi.mock('~/config/fonts', () => ({ sans: { variable: 'font-sans-stub' } }));

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const stylesheetsOf = (source: string) =>
  [...source.matchAll(/^import '([^']+\.css)';$/gm)].map(([, path]) => path);

const render = () =>
  renderToStaticMarkup(
    <GlobalError error={new Error('layout failed')} unstable_retry={() => undefined} />,
  );

test('loads tokens.css, components.css and globals.css, in the order of the root layout', () => {
  const order = ['~/styles/tokens.css', '~/styles/components.css', '~/app/globals.css'];

  expect(stylesheetsOf(read('./[locale]/layout.tsx'))).toEqual(order);
  expect(stylesheetsOf(read('./global-error.tsx'))).toEqual(order);
});

test('puts the font variable of next/font on <html>, as the root layout does', () => {
  expect(render()).toMatch(/^<html lang="en" class="font-sans-stub">/);
});

test('shows the English fallback and a Try again button', () => {
  const html = render();

  expect(html).toContain('<h1>Something went wrong</h1>');
  expect(html).toContain('<button type="button">Try again</button>');
});
