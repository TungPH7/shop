// @vitest-environment node
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { contrast, over, parseColor, readTokens, type Theme } from '~/styles/css-tokens';

// The backdrop of the home page (SHOP-87): a tile of public/images/home-backdrop.svg, drawn here and used as a CSS mask,
// so its colour is the --border token of the theme. It sits behind the content of the page; the words of the page read on
// a line of it as on the page itself, at WCAG AA.
const url = (path: string) => fileURLToPath(new URL(path, import.meta.url));
const read = (path: string) => readFileSync(url(path), 'utf8');
const SVG = '../../public/images/home-backdrop.svg';
const svg = read(SVG);
const tokens = readTokens(read('./tokens.css'));
const color = (name: string, theme: Theme) => parseColor(tokens.value(name, theme));

/** The declarations of the first top-level rule whose selector is exactly `selector`. */
function rule(css: string, selector: string): string {
  const lines = css.split('\n');
  const start = lines.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`No rule ${selector}`);
  const body = lines.slice(start + 1);
  return body.slice(0, body.indexOf('}')).join('\n');
}

describe('the SVG of the home backdrop', () => {
  test('weighs under 5 KB', () => {
    expect(statSync(url(SVG)).size).toBeLessThan(5 * 1024);
  });

  test('is a self-contained SVG: no image, script, link or font from anywhere else', () => {
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).not.toMatch(/<(image|script|foreignObject|text|style|use)\b/i);
    expect(svg).not.toMatch(/\b(xlink:)?href\s*=/i);
    expect(svg).not.toMatch(/url\(|@import|https?:\/\/(?!www\.w3\.org\/2000\/svg")/i);
  });

  test('is well-formed XML: no "--" inside a comment, which stops the browser from decoding it', () => {
    for (const [, comment] of svg.matchAll(/<!--([\s\S]*?)-->/g)) {
      expect(comment).not.toContain('--');
    }
  });

  test('draws a geometric pattern', () => {
    expect(svg).toMatch(/<(circle|path|rect|line|polygon)\b/);
  });
});

describe('the .home-backdrop rule of globals.css', () => {
  const css = read('../app/globals.css');
  const backdrop = rule(css, '.home-backdrop');

  test('stays out of the flow and out of the way of the content: no layout shift, no blocked click', () => {
    expect(backdrop).toMatch(/position:\s*fixed;/);
    expect(backdrop).toMatch(/inset:\s*0;/);
    expect(backdrop).toMatch(/z-index:\s*-1;/);
    expect(backdrop).toMatch(/pointer-events:\s*none;/);
  });

  test('paints the --border token through the SVG, so it follows the theme', () => {
    expect(backdrop).toMatch(/background-color:\s*var\(--border\);/);
    expect(backdrop).toMatch(/mask-image:\s*url\(['"]?\/images\/home-backdrop\.svg['"]?\)/);
  });

  test('the body isolates its layers, so the backdrop is drawn over the page gradient and under the content', () => {
    expect(rule(css, 'body')).toMatch(/isolation:\s*isolate;/);
  });
});

describe.each<Theme>(['light', 'dark'])('words on a line of the backdrop, %s theme', (theme) => {
  // The body is a gradient from --background-from to --background-to; a line of the backdrop is --border over it.
  const grounds = ['--background-from', '--background-to', '--background'];

  test.each(['--foreground', '--muted-foreground', '--hint', '--primary-text'])(
    '%s keeps 4.5:1',
    (text) => {
      for (const ground of grounds) {
        const line = over(color('--border', theme), color(ground, theme));
        expect(contrast(color(text, theme), line)).toBeGreaterThanOrEqual(4.5);
      }
    },
  );
});
