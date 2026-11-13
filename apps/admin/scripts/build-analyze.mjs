// `pnpm build:analyze` → a production build + an interactive bundle treemap
// (bundle-stats.html, gitignored). See vite.config.ts for the visualizer plugin.
//
// Why a Node script instead of `vite build --mode analyze`:
//   - `--mode analyze` would load `.env.analyze` (absent) instead of
//     `.env.production`, so VITE_API_URL goes missing and the Zod check in
//     src/config/env.ts fails fast → the build crashes.
//   - The Vite build API defaults to mode "production", so `.env.production`
//     loads and the report reflects the REAL production bundle.
//   - Setting the flag here (not inline in package.json) is cross-platform — no
//     `cross-env` dependency needed (Windows + CI both work).
import { build } from 'vite';

process.env.ANALYZE = 'true';

await build();
