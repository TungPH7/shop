import { Be_Vietnam_Pro } from 'next/font/google';

// The font of the design system (SHOP-7, plan decision 14; docs/design-system/user.md). next/font downloads the files at
// build time and serves them from this origin, so the CSP keeps `font-src 'self'` and no request goes to Google at run
// time (NFR13). Be Vietnam Pro, not the Urbanist of the reference page: Urbanist has no `vietnamese` subset, so most
// letters with a tone mark (ả, ổ, ữ…) would fall back to another font in the middle of a word.
//
// NFR5: three weights only (500, 600, 700); the `latin`, `latin-ext` and `vietnamese` subsets, each a woff2 file with
// its unicode-range, about 77 KB for the nine files; `display: 'swap'`. `adjustFontFallback` (on by default) adds a
// 'Be Vietnam Pro Fallback' face on Arial with size-adjust and ascent, descent and line-gap overrides, so the swap does
// not move the layout. No `fallback` option: with one, Turbopack drops that adjusted face. The system fonts follow in
// --font (tokens.css), after the --font-sans that `variable` sets on <html>.
export const sans = Be_Vietnam_Pro({
  weight: ['500', '600', '700'],
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  display: 'swap',
  adjustFontFallback: true,
  variable: '--font-sans',
});
