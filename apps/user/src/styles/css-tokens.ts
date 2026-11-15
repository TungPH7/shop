// Reads the design tokens of src/styles/tokens.css in a unit test: jsdom computes no style, so the test resolves the
// custom properties itself. Only what tokens.css uses is supported: top-level `:root` and `.dark` blocks, `var()`
// references, and colours written as `oklch(L C H [/ A])` or hex.

export type Theme = 'light' | 'dark';

/** A colour in sRGB, each channel and the alpha from 0 to 1. */
export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

type Declarations = Map<string, string>;

function declarationsOf(body: string): Declarations {
  const declarations: Declarations = new Map();
  const withoutComments = body.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const part of withoutComments.split(';')) {
    const colon = part.indexOf(':');
    if (colon === -1) continue;
    const name = part.slice(0, colon).trim();
    if (name.startsWith('--'))
      declarations.set(
        name,
        part
          .slice(colon + 1)
          .trim()
          .replace(/\s+/g, ' '),
      );
  }
  return declarations;
}

/** The top-level blocks of a stylesheet, as [selector, body]; nested blocks (`@media`) stay inside their body. */
function topLevelBlocks(css: string): [string, string][] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocks: [string, string][] = [];
  let depth = 0;
  let selectorStart = 0;
  let bodyStart = 0;
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === '{') {
      if (depth === 0) bodyStart = i + 1;
      depth += 1;
    } else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        blocks.push([text.slice(selectorStart, bodyStart - 1).trim(), text.slice(bodyStart, i)]);
        selectorStart = i + 1;
      }
    }
  }
  return blocks;
}

export interface Tokens {
  /** The value of a custom property in a theme, with every `var()` replaced. */
  value(name: string, theme: Theme): string;
  /** The names declared in a top-level block: `:root` or `.dark`. */
  names(selector: ':root' | '.dark'): string[];
}

export function readTokens(css: string): Tokens {
  const root: Declarations = new Map();
  const dark: Declarations = new Map();
  for (const [selector, body] of topLevelBlocks(css)) {
    if (selector === ':root') declarationsOf(body).forEach((value, name) => root.set(name, value));
    if (selector === '.dark') declarationsOf(body).forEach((value, name) => dark.set(name, value));
  }

  const raw = (name: string, theme: Theme): string => {
    const found = (theme === 'dark' ? dark.get(name) : undefined) ?? root.get(name);
    if (found === undefined) throw new Error(`${name} is not declared for the ${theme} theme`);
    return found;
  };

  const value = (name: string, theme: Theme, seen: string[] = []): string => {
    if (seen.includes(name)) throw new Error(`var() cycle: ${[...seen, name].join(' → ')}`);
    return raw(name, theme).replace(/var\((--[\w-]+)\)/g, (_, ref: string) =>
      value(ref, theme, [...seen, name]),
    );
  };

  return {
    value: (name, theme) => value(name, theme),
    names: (selector) => [...(selector === ':root' ? root : dark).keys()],
  };
}

const fromLinear = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

function oklchToRgba(l: number, c: number, hDegrees: number, a: number): Rgba {
  const h = (hDegrees * Math.PI) / 180;
  const labA = c * Math.cos(h);
  const labB = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * labA + 0.2158037573 * labB) ** 3;
  const m_ = (l - 0.1055613458 * labA - 0.0638541728 * labB) ** 3;
  const s_ = (l - 0.0894841775 * labA - 1.291485548 * labB) ** 3;
  return {
    r: clamp01(fromLinear(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_)),
    g: clamp01(fromLinear(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_)),
    b: clamp01(fromLinear(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_)),
    a,
  };
}

/** Parses `oklch(L C H)`, `oklch(L C H / A)` (L from 0 to 1) and `#rgb`, `#rrggbb`, `#rrggbbaa`. */
export function parseColor(value: string): Rgba {
  const oklch = /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)\s*)?\)$/.exec(value);
  if (oklch) {
    const [, l, c, h, a] = oklch;
    return oklchToRgba(Number(l), Number(c), Number(h), a === undefined ? 1 : Number(a));
  }
  const hex = /^#([\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.exec(value)?.[1];
  if (hex !== undefined) {
    const long = hex.length === 3 ? hex.replace(/./g, '$&$&') : hex;
    const digits = long.padEnd(8, 'f');
    const byte = (i: number) => parseInt(digits.slice(i, i + 2), 16) / 255;
    return { r: byte(0), g: byte(2), b: byte(4), a: byte(6) };
  }
  throw new Error(`Not a colour this helper reads: ${value}`);
}

/** `top` painted over `bottom` (source-over). */
export function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a);
  if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
  const mix = (t: number, b: number) => (t * top.a + b * bottom.a * (1 - top.a)) / a;
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a };
}

const luminance = ({ r, g, b }: Rgba) => {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};

/** The WCAG 2.1 contrast ratio of two opaque colours. */
export function contrast(a: Rgba, b: Rgba): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** `#rrggbb`, or `#rrggbbaa` when the colour is not opaque. */
export function toHex({ r, g, b, a }: Rgba): string {
  const byte = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}${a < 1 ? byte(a) : ''}`;
}
