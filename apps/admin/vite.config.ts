import { fileURLToPath, URL } from 'node:url';

import babel from '@rolldown/plugin-babel';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, type PluginOption } from 'vite';

// `pnpm build:analyze` (scripts/build-analyze.mjs) sets ANALYZE=true to emit an
// interactive treemap of the production bundle. Off by default so normal builds
// stay fast and never write a report into the deploy artifact.
const analyze = process.env['ANALYZE'] === 'true';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // React Compiler (v1.0) — automatic memoization. Runs via Babel.
    // Matches the official `pnpm create vite` react-ts scaffold.
    babel({ presets: [reactCompilerPreset()] }),
    // Bundle analysis (opt-in). Vite ignores falsy plugins, so this stays
    // zero-cost unless ANALYZE=true. gzip/brotli sizes reflect what ships.
    analyze &&
      (visualizer({
        filename: 'bundle-stats.html',
        template: 'treemap',
        gzipSize: true,
        brotliSize: true,
        open: false,
      }) as PluginOption),
  ],
  resolve: {
    alias: {
      // Single absolute-import root for the whole app (removes ../../../ chains).
      // Must stay in sync with `paths` in tsconfig.app.json.
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // NOTE: the '@ui' alias (architecture seam #3) is intentionally added later
      // in Phase 1.2 (folder 20+), once a real UI adapter exists to point it at.
    },
  },
  server: {
    port: 5173,
  },
});
