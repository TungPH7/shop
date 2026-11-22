import { describe, expect, it } from 'vitest';

import backdropSvg from '../../public/layout-backdrop.svg?raw';
import componentsCss from './components.css?raw';
import tokensCss from './tokens.css?raw';

// The backdrop of the admin layout (SHOP-88): a light geometric pattern drawn in the
// repo, painted behind the content of every page of RootLayout. The CSS is not loaded
// in unit tests (vitest css: false), so these tests read the files as text; the E2E
// smoke test checks the result in a real browser.
const MAX_SVG_BYTES = 5 * 1024;
const BACKDROP_URL = '/layout-backdrop.svg';

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  if (!match?.[1]) throw new Error(`no rule for ${selector}`);
  return match[1];
}

function parseSvg(text: string): Document {
  return new DOMParser().parseFromString(text, 'image/svg+xml');
}

describe('layout-backdrop.svg', () => {
  it('is a well-formed SVG with a viewBox', () => {
    const doc = parseSvg(backdropSvg);

    expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
    expect(doc.documentElement.tagName).toBe('svg');
    expect(doc.documentElement.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/);
  });

  it('weighs less than 5 KB', () => {
    expect(new TextEncoder().encode(backdropSvg).byteLength).toBeLessThan(MAX_SVG_BYTES);
  });

  it('loads nothing from outside: no image, script, foreign object, link or url()', () => {
    const doc = parseSvg(backdropSvg);

    expect(doc.querySelectorAll('image, script, foreignObject, use, style')).toHaveLength(0);
    expect(backdropSvg).not.toMatch(/href\s*=/i);
    expect(backdropSvg).not.toMatch(/url\(/i);
    expect(backdropSvg).not.toMatch(/https?:\/\/(?!www\.w3\.org\/2000\/svg")/i);
  });

  it('draws shapes only, so it can serve as a mask', () => {
    const doc = parseSvg(backdropSvg);

    expect(doc.querySelectorAll('path, circle, rect, line, polygon').length).toBeGreaterThan(0);
  });
});

describe('backdrop of the app shell (components.css)', () => {
  it('makes .shell its own stacking context, so the backdrop sits above the body gradient', () => {
    expect(ruleBody(componentsCss, '.shell')).toMatch(/isolation:\s*isolate;/);
  });

  it('paints the SVG as a mask of a fixed layer behind the content', () => {
    const body = ruleBody(componentsCss, '.shell::before');

    expect(body).toMatch(/content:\s*'';/);
    expect(body).toMatch(/position:\s*fixed;/);
    expect(body).toMatch(/inset:\s*0;/);
    expect(body).toMatch(/z-index:\s*-1;/);
    expect(body).toContain(`url('${BACKDROP_URL}')`);
    expect(body).toMatch(/mask-repeat:\s*repeat;/);
  });

  it('lets clicks through, so it never covers a table or a form', () => {
    expect(ruleBody(componentsCss, '.shell::before')).toMatch(/pointer-events:\s*none;/);
  });

  it('takes its colour from the --backdrop-line token', () => {
    expect(ruleBody(componentsCss, '.shell::before')).toMatch(
      /background-color:\s*var\(--backdrop-line\);/,
    );
  });

  it('is left out in forced-colors mode', () => {
    expect(componentsCss).toMatch(
      /@media \(forced-colors: active\)\s*\{\s*\.shell::before\s*\{\s*display:\s*none;/,
    );
  });
});

describe('--backdrop-line token (tokens.css)', () => {
  it('has a light and a dark value', () => {
    expect(tokensCss).toMatch(/--backdrop-line:\s*light-dark\(#[0-9a-f]{8},\s*#[0-9a-f]{8}\);/);
  });
});
