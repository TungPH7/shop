// @vitest-environment node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import {
  contrast,
  over,
  parseColor,
  readTokens,
  type Rgba,
  type Theme,
  toHex,
} from '~/styles/css-tokens';

// The colour tokens of user against the Design System table of docs/specs/SHOP-7/design.md (SHOP-10). tokens.css keeps
// the semantic role names user already had and writes the values in OKLCH; this test pins each role to the hex of the
// design, in both themes, and checks the WCAG AA pairs the design promises. docs/design-system/user.md maps each role.
const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');
const css = read('./tokens.css');
const tokens = readTokens(css);
const color = (name: string, theme: Theme) => parseColor(tokens.value(name, theme));

/** True when every channel, alpha included, is within 1 step of 255 of the expected hex. */
function sameColor(actual: Rgba, expectedHex: string) {
  const expected = parseColor(expectedHex);
  return (['r', 'g', 'b', 'a'] as const).every(
    (channel) => Math.abs(actual[channel] - expected[channel]) <= 1.5 / 255,
  );
}

// [role, light, dark]. Tints are the fill at 14% (light) and 16% (dark); the focus halo is the accent at 18%.
const DESIGN: [string, string, string][] = [
  ['--background', '#f2f4f8', '#111113'],
  ['--background-from', '#eef1f6', '#0c0c0e'],
  ['--background-to', '#f6f8fb', '#131316'],
  ['--foreground', '#0f1724', '#f6f8fc'],
  ['--surface', '#ffffffb8', '#1e1e226b'],
  ['--surface-foreground', '#0f1724', '#f6f8fc'],
  ['--solid', '#ffffff', '#1d1d21'],
  ['--dialog', '#fffffff0', '#1c1c20db'],
  ['--muted', '#0f17240d', '#ffffff14'],
  ['--muted-foreground', '#3b475a', '#c9d1de'],
  ['--hint', '#556074', '#9aa1ad'],
  ['--border', '#0f17241a', '#ffffff1a'],
  ['--border-strong', '#0f17242e', '#ffffff2e'],
  ['--control-border', '#667184', '#7d8696'],
  ['--well', '#0f17240d', '#c8c8d71a'],
  ['--ring', '#2a5db8', '#8dbcf6'],
  ['--primary', '#2b63c4', '#7aaef0'],
  ['--primary-foreground', '#ffffff', '#071a33'],
  ['--primary-text', '#1a56b0', '#a9cdfc'],
  ['--secondary', '#0f17240d', '#ffffff14'],
  ['--secondary-foreground', '#0f1724', '#f6f8fc'],
  ['--focus-halo', '#2b63c42e', '#7aaef02e'],
  ['--success', '#2f9e5b', '#5fc483'],
  ['--success-text', '#166534', '#8fdca8'],
  ['--success-tint', '#2f9e5b24', '#5fc48329'],
  ['--warning', '#c98a08', '#e4b759'],
  ['--warning-text', '#8a5300', '#f3cd7e'],
  ['--warning-tint', '#c98a0824', '#e4b75929'],
  ['--info', '#2b63c4', '#7aaef0'],
  ['--info-text', '#1a56b0', '#a9cdfc'],
  ['--info-tint', '#2b63c424', '#7aaef029'],
  ['--danger', '#d4493c', '#e98278'],
  ['--danger-text', '#b42318', '#f6a59c'],
  ['--danger-tint', '#d4493c24', '#e9827829'],
];

// Group colours of the placeholder tile: [group, from, to, text], the same in both themes.
const GROUPS: [string, string, string, string][] = [
  ['blue', '#354a6a', '#283953', '#eef4fd'],
  ['coral', '#6a423d', '#52322e', '#fdeeeb'],
  ['green', '#375741', '#29432f', '#eef9f1'],
  ['orange', '#66503a', '#4e3d2b', '#fdf3e6'],
  ['teal', '#31574f', '#24433d', '#ecf8f5'],
  ['ink', '#3b3e46', '#2c2e34', '#f1f2f5'],
];

const THEMES: Theme[] = ['light', 'dark'];

describe('colour tokens match the Design System table', () => {
  test.each(DESIGN)('%s is %s in light and %s in dark', (role, light, dark) => {
    expect(toHex(color(role, 'light'))).toSatisfy((hex: string) =>
      sameColor(parseColor(hex), light),
    );
    expect(toHex(color(role, 'dark'))).toSatisfy((hex: string) => sameColor(parseColor(hex), dark));
  });

  test.each(GROUPS)(
    'group %s is %s to %s with text %s, in both themes',
    (group, from, to, text) => {
      for (const theme of THEMES) {
        expect(sameColor(color(`--group-${group}-from`, theme), from)).toBe(true);
        expect(sameColor(color(`--group-${group}-to`, theme), to)).toBe(true);
        expect(sameColor(color(`--group-${group}-text`, theme), text)).toBe(true);
      }
    },
  );

  test('the dark block re-maps only semantic roles, never a primitive of the palette', () => {
    const palette = /^--(graphite|slate|mist|white|blue|green|red|amber)-?/;
    expect(tokens.names('.dark').filter((name) => palette.test(name))).toEqual([]);
  });

  test('a status role names its words -text, like --primary-text, and has no -foreground', () => {
    // -foreground means "the words on the fill" (--primary-foreground on --primary). The words of a status sit on the
    // page or on the tint, so they are --danger-text and the rest: a --danger-foreground would read as white on red.
    const status = /^--(success|warning|info|danger)-foreground$/;
    expect(tokens.names(':root').filter((name) => status.test(name))).toEqual([]);
    expect(tokens.names('.dark').filter((name) => status.test(name))).toEqual([]);
  });

  test('the primary button gets lighter on hover in both themes', () => {
    for (const theme of THEMES) {
      const hover = tokens.value('--primary-hover', theme);
      expect(hover).toBe(
        `color-mix(in oklch, ${tokens.value('--primary', theme)}, oklch(1 0 0) 6%)`,
      );
    }
  });
});

describe.each(THEMES)('WCAG AA contrast in the %s theme', (theme) => {
  const page = () => color('--background', theme);
  const on = (layer: string) => over(color(layer, theme), page());

  test.each([
    ['--foreground', '--background'],
    ['--foreground', '--surface'],
    ['--foreground', '--solid'],
    ['--foreground', '--dialog'],
    ['--foreground', '--muted'],
    ['--foreground', '--well'],
    ['--muted-foreground', '--background'],
    ['--muted-foreground', '--surface'],
    ['--hint', '--background'],
    ['--hint', '--surface'],
    ['--hint', '--muted'],
    ['--primary-text', '--background'],
    ['--primary-text', '--surface'],
    ['--primary-foreground', '--primary'],
    ['--success-text', '--success-tint'],
    ['--warning-text', '--warning-tint'],
    ['--info-text', '--info-tint'],
    ['--danger-text', '--danger-tint'],
    ['--danger-text', '--surface'],
  ])('text %s on %s is at least 4.5:1', (text, background) => {
    expect(contrast(color(text, theme), on(background))).toBeGreaterThanOrEqual(4.5);
  });

  test.each([
    ['--control-border', '--muted'],
    ['--ring', '--background'],
    ['--ring', '--surface'],
  ])('control %s against %s is at least 3:1 (WCAG 1.4.11)', (control, background) => {
    expect(contrast(color(control, theme), on(background))).toBeGreaterThanOrEqual(3);
  });

  test.each(GROUPS.map(([group]) => group))('the letter of group %s is at least 4.5:1', (group) => {
    const text = color(`--group-${group}-text`, theme);
    expect(contrast(text, color(`--group-${group}-from`, theme))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(text, color(`--group-${group}-to`, theme))).toBeGreaterThanOrEqual(4.5);
  });
});

// The stylesheets that read the tokens. A var() of a name that nothing declares is silently invalid, so a renamed token
// would leave a class without its colour and no other test would see it.
describe.each(['./components.css', '../app/globals.css'])('%s', (path) => {
  const sheet = read(path);
  const declaredIn = (source: string) =>
    [...source.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map(([, name]) => name);

  test('reads only custom properties that tokens.css or the sheet itself declares', () => {
    const known = new Set([
      ...tokens.names(':root'),
      ...tokens.names('.dark'),
      ...declaredIn(sheet),
    ]);
    const used = [...sheet.matchAll(/var\((--[\w-]+)/g)].map(([, name]) => name);
    expect(used.filter((name) => !known.has(name))).toEqual([]);
  });
});
